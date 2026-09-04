from django.http import JsonResponse

from .models import Movement
from .parsers import parse_pdf, parse_xls
from .services import store_records


def list_movements(request):
    return JsonResponse(list(Movement.objects.values(
        'date', 'description', 'amount', 'balance', 'category',
    )), safe=False)


def import_movements(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Usa POST para importar archivos'}, status=405)
    results = []
    for upload in request.FILES.getlist('files'):
        try:
            parser = parse_xls if upload.name.lower().endswith('.xls') else parse_pdf if upload.name.lower().endswith('.pdf') else None
            if parser is None:
                raise ValueError('Formato no reconocido')
            imported, skipped = store_records(parser(upload))
            results.append({'name': upload.name, 'imported': imported, 'skipped': skipped, 'error': ''})
        except ValueError as error:
            results.append({'name': upload.name, 'imported': 0, 'skipped': 0, 'error': str(error)})
    return JsonResponse({'files': results})

# Create your views here.
