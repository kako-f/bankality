from io import BytesIO
from datetime import date

from django.test import SimpleTestCase
from openpyxl import Workbook

from movements.parsers import category, parse_pdf_text, parse_xls_rows, parse_xlsx


class ParserTests(SimpleTestCase):
    def test_groups_transfer_category_variants(self):
        for description, amount in (
            ('Transferencia', -100),
            ('Transferencias recibidas', 100),
            ('Transferencia recibida', 100),
            ('Traspaso enviado', -100),
        ):
            with self.subTest(description=description):
                expected = 'Transferencias recibidas' if amount > 0 else 'Transferencias enviadas'
                self.assertEqual(category(description, amount), expected)

    def test_parses_bci_last_movements_rows(self):
        rows = [
            [None, None, None, 'Saldo Contable', '3.505.003', None, None, None],
            ['Fecha Transacción', 'Fecha Contable', 'Descripción', None, None, None, 'Cargo $', 'Abono $'],
            ['06/09/2026', '07/09/2026', 'Transferencia recibida', None, None, None, None, '152.000'],
            ['06/09/2026', '07/09/2026', 'Transferencia enviada', None, None, None, '14.975', None],
        ]

        parsed = parse_xls_rows(rows)

        self.assertEqual([item['amount'] for item in parsed], [-14975, 152000])
        self.assertEqual([item['balance'] for item in parsed], [3353003, 3505003])

    def test_parses_xlsx_workbook(self):
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(['Fecha', 'Descripción', 'Serie', 'Monto $', 'Saldo Contable $'])
        sheet.append(['03-09-2026', 'Compra', '1', '-2.200', '3.308.103'])
        payload = BytesIO()
        workbook.save(payload)
        payload.seek(0)

        self.assertEqual(parse_xlsx(payload)[0]['description'], 'Compra')

    def test_parses_xlrd_cells(self):
        class Cell:
            def __init__(self, value):
                self.value = value

        rows = [
            [Cell(value) for value in ['Fecha', 'Descripción', 'Serie', 'Monto $', 'Saldo Contable $']],
            [Cell(value) for value in ['03-09-2026', 'Compra', '1', '-2.200', ' 3.308.103']],
        ]

        self.assertEqual(parse_xls_rows(rows)[0]['amount'], -2200)

    def test_parses_xls_rows(self):
        rows = [
            ['Fecha', 'Descripción', 'Serie', 'Monto $', 'Saldo Contable $'],
            ['03-09-2026', 'Compra Tarjeta Debito', '1', '-2.200', ' 3.308.103'],
            ['03-09-2026', 'Pago Recibido REMUNERACION', '2', '1.957.159', ' 5.265.262'],
        ]

        self.assertEqual(parse_xls_rows(rows), [
            {'date': date(2026, 9, 3), 'description': 'Pago Recibido REMUNERACION', 'amount': 1957159, 'balance': 5265262, 'category': 'Remuneración'},
            {'date': date(2026, 9, 3), 'description': 'Compra Tarjeta Debito', 'amount': -2200, 'balance': 3308103, 'category': 'Compras'},
        ])

    def test_orders_xls_rows_chronologically(self):
        rows = [
            ['Fecha', 'Descripción', 'Serie', 'Monto $', 'Saldo Contable $'],
            ['03-09-2026', 'Último', '1', '-2.200', ' 3.308.103'],
            ['02-09-2026', 'Anterior', '2', '-1.000', ' 3.310.303'],
        ]

        self.assertEqual(
            [item['date'] for item in parse_xls_rows(rows)],
            [date(2026, 9, 2), date(2026, 9, 3)],
        )

    def test_parses_pdf_text(self):
        text = '''
  03/09/2026      UGCA AUT       COMPRA TARJETA DEBITO                  1                 2.200                              3.308.103
  03/09/2026      OF CENTRA      TRANSFER DE PRUEBA                    2                                      5.000              3.313.103
'''

        self.assertEqual([item['amount'] for item in parse_pdf_text(text)], [-2200, 5000])

    def test_rejects_text_without_movement_rows(self):
        with self.assertRaises(ValueError):
            parse_pdf_text('No es una cartola')
