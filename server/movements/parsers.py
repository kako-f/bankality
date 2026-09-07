import re
import subprocess
import tempfile
from datetime import date, datetime
from pathlib import Path

import xlrd
import openpyxl


def category(description, amount):
    text = description.upper()
    if 'TRANSFER' in text or 'TRASPASO' in text:
        return 'Transferencias recibidas' if amount > 0 else 'Transferencias enviadas'
    if any(term in text for term in ('CONCESION ALIMENT', 'LA TERESA')):
        return 'Cafes/Negocio'
    if amount > 0:
        if 'REMUNERACION' in text:
            return 'Remuneración'
        return 'Otros abonos'
    if any(term in text for term in ('JUMBO', 'UNIMARC', 'TOTTUS', 'EXPRESS')):
        return 'Supermercado'
    if any(term in text for term in ('CONCESION', 'CHILEPASA', 'PARK', 'PLAZA MAULE')):
        return 'Transporte'
    if 'MERCADOPAGO' in text:
        return 'MercadoPago'
    if any(term in text for term in ('PAGO CUENTAS', 'COMISION', 'CARGO ', 'I.MUNICIP', 'I MUNI')):
        return 'Cuentas y cargos'
    if any(term in text for term in ('CAFE', 'CAFETERIA', 'COFFEE', 'BURGER', 'TUU*')):
        return 'Cafés y comida'
    if 'PAGO DEUDA' in text:
        return 'Deuda de tarjeta'
    return 'Compras'


def parse_amount(value):
    if isinstance(value, (int, float)):
        return int(value)
    return int(str(value).replace('$', '').replace('.', '').replace(' ', ''))


def parse_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    for pattern in ('%d-%m-%Y', '%d/%m/%Y'):
        try:
            return datetime.strptime(str(value), pattern).date()
        except ValueError:
            pass
    raise ValueError('Fecha no reconocida')


def normalize(date_value, description, amount, balance):
    amount = parse_amount(amount)
    return {
        'date': parse_date(date_value),
        'description': str(description).strip(),
        'amount': amount,
        'balance': parse_amount(balance),
        'category': category(str(description), amount),
    }


def parse_xls_rows(rows):
    rows = [[getattr(cell, 'value', cell) for cell in row] for row in rows]
    header_index = next((index for index, row in enumerate(rows) if any(str(value).strip().startswith('Fecha') for value in row)), None)
    if header_index is None:
        raise ValueError('No se encontró el encabezado de movimientos')
    headers = {str(value).strip(): index for index, value in enumerate(rows[header_index])}
    if {'Fecha Transacción', 'Descripción', 'Cargo $', 'Abono $'} <= headers.keys():
        return parse_bci_rows(rows, header_index, headers)
    required = ('Fecha', 'Descripción', 'Monto $', 'Saldo Contable $')
    if any(name not in headers for name in required):
        raise ValueError('Columnas de movimientos no reconocidas')
    parsed = []
    for row in rows[header_index + 1:]:
        if not row or not row[headers['Fecha']]:
            continue
        parsed.append(normalize(
            row[headers['Fecha']], row[headers['Descripción']],
            row[headers['Monto $']], row[headers['Saldo Contable $']],
        ))
    if not parsed:
        raise ValueError('El archivo no contiene movimientos')
    return list(reversed(parsed))


def parse_bci_rows(rows, header_index, headers):
    starting_balance = next(
        (parse_amount(value) for row in rows[:header_index]
         for index, value in enumerate(row)
         if str(value).strip() == 'Saldo Contable'
         for value in row[index + 1:] if value not in (None, '')),
        None,
    )
    if starting_balance is None:
        raise ValueError('No se encontró el saldo contable inicial')
    parsed = []
    balance = starting_balance
    for row in rows[header_index + 1:]:
        if not row or not row[headers['Fecha Transacción']]:
            continue
        credit = row[headers['Abono $']]
        debit = row[headers['Cargo $']]
        if credit in (None, '') and debit in (None, ''):
            continue
        amount = parse_amount(credit) if credit not in (None, '') else -parse_amount(debit)
        parsed.append(normalize(
            row[headers['Fecha Transacción']], row[headers['Descripción']], amount, balance,
        ))
        balance -= amount
    if not parsed:
        raise ValueError('El archivo no contiene movimientos')
    return list(reversed(parsed))


def parse_xls(upload):
    workbook = xlrd.open_workbook(file_contents=upload.read())
    return parse_xls_rows(workbook.sheet_by_index(0).get_rows())


def parse_xlsx(upload):
    workbook = openpyxl.load_workbook(upload, data_only=True)
    try:
        return parse_xls_rows(workbook.active.iter_rows())
    finally:
        workbook.close()


DATE_LINE = re.compile(r'^\s*(\d{2}/\d{2}/\d{4})')
TAIL = re.compile(r'\s+([0-9][0-9.]*)\s+([0-9][0-9.]*)\s*$')
BRANCH = re.compile(r'^\s*\d{2}/\d{2}/\d{4}\s+(?:OF CENTRA|UGCA AUT|OF VIRT U|PZA EL TR)\s*')


def parse_pdf_text(text):
    parsed = []
    previous_balance = None
    pending = ''
    for line in text.splitlines():
        if re.search(r'TRASPASO FONDOS|PAGO RECIBIDO|ABONO POR|CARGO POR|PAGO DEUDA', line):
            pending = ' '.join(line.split())
        if not DATE_LINE.match(line):
            continue
        tail = TAIL.search(line)
        if not tail:
            continue
        prefix = BRANCH.sub('', line[:tail.start()])
        description = re.sub(r'\s+\d+\s*$', '', prefix).strip() or pending or 'Movimiento bancario'
        amount, balance = (parse_amount(value) for value in tail.groups())
        debit = balance < previous_balance if previous_balance is not None else not re.search(r'TRANSFER DE|ABONO', description)
        parsed.append(normalize(
            DATE_LINE.match(line).group(1), description, -amount if debit else amount, balance,
        ))
        previous_balance = balance
        pending = ''
    if not parsed:
        raise ValueError('No se encontraron movimientos BCI en el PDF')
    return parsed


def parse_pdf(upload):
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temporary:
        for chunk in upload.chunks():
            temporary.write(chunk)
        path = Path(temporary.name)
    try:
        result = subprocess.run(['pdftotext', '-layout', str(path), '-'], check=True, capture_output=True, text=True)
        return parse_pdf_text(result.stdout)
    except subprocess.CalledProcessError as error:
        raise ValueError('No se pudo leer el PDF') from error
    finally:
        path.unlink(missing_ok=True)
