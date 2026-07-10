from __future__ import annotations

import sys
import tempfile
import unittest
import zipfile
from datetime import datetime, timedelta, timezone
from email.header import Header
from email.message import EmailMessage
from io import BytesIO
from pathlib import Path

from openpyxl import Workbook

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import update_stock_from_yandex as updater  # noqa: E402


def workbook_bytes(value: str) -> bytes:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Остатки"
    worksheet["A1"] = value
    stream = BytesIO()
    workbook.save(stream)
    workbook.close()
    return stream.getvalue()


def mail_message(
    *,
    sender: str = updater.EXPECTED_SENDER,
    subject: str = "Остатки товаров на 10.07.2026",
    payload: bytes | None = None,
    filename: str = "Остатки товаров.xlsx",
) -> EmailMessage:
    message = EmailMessage()
    message["From"] = sender
    message["To"] = "recipient@example.com"
    message["Subject"] = subject
    message.set_content("Файл во вложении.")
    if payload is not None:
        message.add_attachment(
            payload,
            maintype="application",
            subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename,
        )
    return message


class FakeIMAP:
    """Small offline IMAP double that returns realistic UID FETCH responses."""

    def __init__(self, messages: dict[int, tuple[datetime, EmailMessage]]) -> None:
        self.messages = messages
        self.calls: list[tuple[str, tuple[object, ...]]] = []

    def uid(self, command: str, *args: object):
        self.calls.append((command, args))
        if command == "SEARCH":
            encoded = b" ".join(str(uid).encode("ascii") for uid in self.messages)
            return "OK", [encoded]
        if command != "FETCH":
            return "BAD", []

        uid_arg = args[0]
        uid = int(uid_arg.decode("ascii") if isinstance(uid_arg, bytes) else str(uid_arg))
        received_at, message = self.messages[uid]
        raw_message = message.as_bytes()
        local_time = received_at.astimezone(received_at.tzinfo or timezone.utc)
        offset = local_time.strftime("%z") or "+0000"
        internal_date = (
            f"{local_time.day:02d}-{updater._MONTH_NAMES[local_time.month - 1]}-"
            f"{local_time.year:04d} {local_time:%H:%M:%S} {offset}"
        )
        metadata = (
            f'{uid} (UID {uid} INTERNALDATE "{internal_date}" '
            f"BODY[] {{{len(raw_message)}}}"
        ).encode("ascii")
        return "OK", [(metadata, raw_message), b")"]


class TrailingDateIMAP(FakeIMAP):
    """Yandex-style FETCH: BODY literal first, INTERNALDATE in a trailing part."""

    def uid(self, command: str, *args: object):
        if command != "FETCH":
            return super().uid(command, *args)
        self.calls.append((command, args))
        uid_arg = args[0]
        uid = int(uid_arg.decode("ascii") if isinstance(uid_arg, bytes) else str(uid_arg))
        received_at, message = self.messages[uid]
        raw_message = message.as_bytes()
        local_time = received_at.astimezone(received_at.tzinfo or timezone.utc)
        offset = local_time.strftime("%z") or "+0000"
        internal_date = (
            f"{local_time.day:02d}-{updater._MONTH_NAMES[local_time.month - 1]}-"
            f"{local_time.year:04d} {local_time:%H:%M:%S} {offset}"
        )
        prefix = f"{uid} (UID {uid} BODY[] {{{len(raw_message)}}}".encode("ascii")
        trailing = f' INTERNALDATE "{internal_date}")'.encode("ascii")
        return "OK", [(prefix, raw_message), trailing]


class MimeTests(unittest.TestCase):
    def test_parses_space_padded_single_digit_internaldate(self) -> None:
        parsed = updater.parse_internaldate(
            b'1 (UID 1 INTERNALDATE " 7-Jul-2026 09:08:07 +0500")'
        )
        self.assertEqual(
            parsed,
            datetime(2026, 7, 7, 4, 8, 7, tzinfo=timezone.utc),
        )

    def test_decodes_russian_subject_and_prefers_stock_attachment(self) -> None:
        encoded_subject = Header("Остатки товаров на 10.07.2026", "utf-8").encode()
        self.assertIn(
            "Остатки товаров",
            updater.decode_mime_header(encoded_subject),
        )

        payload = workbook_bytes("новые")
        message = mail_message(payload=None)
        message.add_attachment(
            b"not an Excel workbook",
            maintype="application",
            subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename="other.xlsx",
        )
        message.add_attachment(
            payload,
            maintype="application",
            subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename="Остатки товаров 10.07.2026.XLSX",
        )
        message.add_attachment(
            payload,
            maintype="application",
            subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename="~$Остатки товаров.xlsx",
        )

        candidate = updater.select_xlsx_attachment(message)
        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertEqual(candidate.filename, "Остатки товаров 10.07.2026.XLSX")
        self.assertEqual(updater.attachment_payload(candidate), payload)


class WorkbookInstallTests(unittest.TestCase):
    def test_validates_and_installs_new_workbook(self) -> None:
        payload = workbook_bytes("новые остатки")
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "stock-data" / "stock.xlsx"
            result = updater.install_payload_atomically(payload, target)

            self.assertEqual(result.outcome, updater.Outcome.UPDATED)
            self.assertTrue(result.changed)
            self.assertEqual(target.read_bytes(), payload)
            self.assertEqual(list(target.parent.glob(".stock-download-*")), [])

    def test_identical_workbook_does_not_touch_target(self) -> None:
        payload = workbook_bytes("без изменений")
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "stock-data" / "stock.xlsx"
            target.parent.mkdir(parents=True)
            target.write_bytes(payload)
            original_stat = target.stat()

            result = updater.install_payload_atomically(payload, target)

            self.assertEqual(result.outcome, updater.Outcome.UNCHANGED)
            self.assertFalse(result.changed)
            self.assertEqual(target.read_bytes(), payload)
            self.assertEqual(target.stat().st_mtime_ns, original_stat.st_mtime_ns)

    def test_corrupt_attachment_leaves_old_workbook_unchanged(self) -> None:
        old_payload = workbook_bytes("старые остатки")
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "stock-data" / "stock.xlsx"
            target.parent.mkdir(parents=True)
            target.write_bytes(old_payload)

            with self.assertRaises(updater.AttachmentValidationError):
                updater.install_payload_atomically(b"not a zip file", target)

            self.assertEqual(target.read_bytes(), old_payload)
            self.assertEqual(list(target.parent.glob(".stock-download-*")), [])

    def test_malformed_workbook_xml_leaves_old_workbook_unchanged(self) -> None:
        old_payload = workbook_bytes("старые остатки")
        valid_payload = workbook_bytes("новые остатки")
        malformed_stream = BytesIO()
        with zipfile.ZipFile(BytesIO(valid_payload)) as source:
            with zipfile.ZipFile(malformed_stream, "w") as destination:
                for member in source.infolist():
                    content = source.read(member.filename)
                    if member.filename == "xl/workbook.xml":
                        content = b"<workbook>"
                    destination.writestr(member, content)

        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "stock-data" / "stock.xlsx"
            target.parent.mkdir(parents=True)
            target.write_bytes(old_payload)

            with self.assertRaises(updater.AttachmentValidationError):
                updater.install_payload_atomically(malformed_stream.getvalue(), target)

            self.assertEqual(target.read_bytes(), old_payload)
            self.assertEqual(list(target.parent.glob(".stock-download-*")), [])


class MailboxTests(unittest.TestCase):
    def test_parses_internaldate_from_trailing_fetch_fragment(self) -> None:
        now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
        payload = workbook_bytes("новые")
        mailbox = TrailingDateIMAP(
            {7: (now - timedelta(hours=1), mail_message(payload=payload))}
        )
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "stock.xlsx"
            result = updater.process_mailbox(
                mailbox, target=target, now=now, max_age_hours=72
            )
            self.assertEqual(result.outcome, updater.Outcome.UPDATED)
            self.assertEqual(target.read_bytes(), payload)

    def test_uses_latest_fresh_exact_match_without_network(self) -> None:
        now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
        older_payload = workbook_bytes("старые")
        latest_payload = workbook_bytes("новые")
        mailbox = FakeIMAP(
            {
                10: (now - timedelta(hours=2), mail_message(payload=older_payload)),
                11: (
                    now - timedelta(hours=1),
                    mail_message(sender="other@example.com", payload=latest_payload),
                ),
                12: (
                    now - timedelta(minutes=10),
                    mail_message(payload=latest_payload, filename="Остатки новые.xlsx"),
                ),
                13: (
                    now - timedelta(minutes=1),
                    mail_message(subject="Другая тема", payload=workbook_bytes("не брать")),
                ),
            }
        )

        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "stock-data" / "stock.xlsx"
            result = updater.process_mailbox(
                mailbox,
                target=target,
                now=now,
                max_age_hours=72,
            )

            self.assertEqual(result.outcome, updater.Outcome.UPDATED)
            self.assertEqual(target.read_bytes(), latest_payload)
        fetch_queries = [str(args[1]) for command, args in mailbox.calls if command == "FETCH"]
        self.assertTrue(fetch_queries)
        self.assertTrue(all("BODY.PEEK" in query for query in fetch_queries))

    def test_stale_message_is_a_successful_noop(self) -> None:
        now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
        mailbox = FakeIMAP(
            {
                20: (
                    now - timedelta(hours=73),
                    mail_message(payload=workbook_bytes("устарело")),
                )
            }
        )

        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "stock.xlsx"
            result = updater.process_mailbox(
                mailbox,
                target=target,
                now=now,
                max_age_hours=72,
            )

            self.assertEqual(result.outcome, updater.Outcome.NO_MESSAGE)
            self.assertFalse(result.changed)
            self.assertFalse(target.exists())

    def test_latest_matching_email_without_xlsx_is_a_successful_noop(self) -> None:
        now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
        older = mail_message(payload=workbook_bytes("старые"))
        latest = mail_message(payload=None)
        latest.add_attachment(
            b"not stock",
            maintype="application",
            subtype="pdf",
            filename="document.pdf",
        )
        mailbox = FakeIMAP(
            {
                30: (now - timedelta(hours=1), older),
                31: (now - timedelta(minutes=5), latest),
            }
        )

        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "stock.xlsx"
            result = updater.process_mailbox(
                mailbox,
                target=target,
                now=now,
                max_age_hours=72,
            )

            self.assertEqual(result.outcome, updater.Outcome.NO_ATTACHMENT)
            self.assertFalse(result.changed)
            self.assertFalse(target.exists())


if __name__ == "__main__":
    unittest.main()
