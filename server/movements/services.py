import hashlib

from django.db import transaction

from .models import Category, Movement


def fingerprint(record):
    value = '|'.join(str(record[field]) for field in ('date', 'description', 'amount', 'balance', 'category'))
    return hashlib.sha256(value.encode()).hexdigest()


def catalog_name(value):
    if not isinstance(value, str):
        raise ValueError('Categoría no reconocida')
    value = value.strip()
    if not 1 <= len(value) <= 80:
        raise ValueError('Categoría no reconocida')
    return value


def store_records(records):
    imported = skipped = 0
    with transaction.atomic():
        for record in records:
            Category.objects.get_or_create(name=catalog_name(record['category']))
            _, created = Movement.objects.get_or_create(fingerprint=fingerprint(record), defaults=record)
            imported += created
            skipped += not created
    return imported, skipped
