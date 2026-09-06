from datetime import date
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from movements.models import Category, Movement
from movements.services import fingerprint, store_records


RECORD = {
    'date': date(2026, 9, 3), 'description': 'Compra', 'amount': -2200,
    'balance': 3308103, 'category': 'Compras',
}


class ImportTests(TestCase):
    def test_normalizes_catalog_category_without_changing_movement_or_fingerprint(self):
        record = {**RECORD, 'category': '  Compras  '}

        store_records([record])

        movement = Movement.objects.get()
        self.assertTrue(Category.objects.filter(name='Compras').exists())
        self.assertFalse(Category.objects.filter(name='  Compras  ').exists())
        self.assertEqual(movement.category, '  Compras  ')
        self.assertEqual(movement.fingerprint, fingerprint(record))

    def test_rejects_blank_and_oversized_catalog_categories(self):
        category_count = Category.objects.count()
        for category in ('   ', 'x' * 81):
            with self.subTest(category=category):
                with self.assertRaises(ValueError):
                    store_records([{**RECORD, 'category': category}])

        self.assertEqual(Category.objects.count(), category_count)
        self.assertEqual(Movement.objects.count(), 0)

    @patch('movements.views.parse_xls', return_value=[RECORD])
    def test_creates_catalog_category_from_import(self, _):
        response = self.client.post('/api/imports', {'files': [SimpleUploadedFile('movements.xls', b'fixture')]})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(Category.objects.filter(name='Compras').exists())

    @patch('movements.views.parse_xls', return_value=[RECORD])
    def test_imports_once_then_skips_duplicates(self, _):
        upload = SimpleUploadedFile('movements.xls', b'fixture')
        response = self.client.post('/api/imports', {'files': [upload]})
        repeat = self.client.post('/api/imports', {'files': [SimpleUploadedFile('movements.xls', b'fixture')]})

        self.assertEqual(response.json()['files'][0]['imported'], 1)
        self.assertEqual(repeat.json()['files'][0]['skipped'], 1)
        self.assertEqual(Movement.objects.count(), 1)

    @patch('movements.views.parse_pdf', side_effect=ValueError('Formato no reconocido'))
    @patch('movements.views.parse_xls', return_value=[RECORD])
    def test_keeps_valid_import_when_another_file_is_invalid(self, _, __):
        response = self.client.post('/api/imports', {'files': [
            SimpleUploadedFile('valid.xls', b'fixture'),
            SimpleUploadedFile('invalid.pdf', b'fixture'),
        ]})

        self.assertEqual(response.json()['files'][0]['imported'], 1)
        self.assertEqual(response.json()['files'][1]['error'], 'Formato no reconocido')
        self.assertEqual(Movement.objects.count(), 1)
