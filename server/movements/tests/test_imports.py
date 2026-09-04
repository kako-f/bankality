from datetime import date
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from movements.models import Movement


RECORD = {
    'date': date(2026, 9, 3), 'description': 'Compra', 'amount': -2200,
    'balance': 3308103, 'category': 'Compras',
}


class ImportTests(TestCase):
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
