import hashlib

from .models import Movement


def fingerprint(record):
    value = '|'.join(str(record[field]) for field in ('date', 'description', 'amount', 'balance', 'category'))
    return hashlib.sha256(value.encode()).hexdigest()


def store_records(records):
    imported = skipped = 0
    for record in records:
        _, created = Movement.objects.get_or_create(fingerprint=fingerprint(record), defaults=record)
        imported += created
        skipped += not created
    return imported, skipped
