import hashlib

from django.db import transaction

from .models import Category, Movement


def fingerprint(record):
    value = '|'.join(str(record[field]) for field in ('date', 'description', 'amount', 'balance', 'category'))
    return hashlib.sha256(value.encode()).hexdigest()


def store_records(records):
    imported = skipped = 0
    with transaction.atomic():
        for record in records:
            Category.objects.get_or_create(name=record['category'])
            _, created = Movement.objects.get_or_create(fingerprint=fingerprint(record), defaults=record)
            imported += created
            skipped += not created
    return imported, skipped
