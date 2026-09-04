import json
from datetime import date
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from movements.services import store_records


class Command(BaseCommand):
    def handle(self, *args, **options):
        path = Path(__file__).resolve().parents[3] / 'private' / 'initial_movements.json'
        if not path.exists():
            raise CommandError('Crea server/private/initial_movements.json antes de sembrar datos')
        records = json.loads(path.read_text())
        for record in records:
            record['date'] = date.fromisoformat(record['date'])
        imported, skipped = store_records(records)
        self.stdout.write(f'Importados: {imported}; omitidos: {skipped}')
