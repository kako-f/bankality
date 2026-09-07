import json

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import Category, Movement
from .parsers import parse_pdf, parse_xls, parse_xlsx
from .services import catalog_name, store_records


def json_payload(request):
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError, TypeError):
        return None, JsonResponse({'error': 'JSON no reconocido'}, status=400)
    if not isinstance(payload, dict):
        return None, JsonResponse({'error': 'JSON no reconocido'}, status=400)
    return payload, None


def category_name(payload):
    try:
        return catalog_name(payload.get('name')), None
    except ValueError:
        return None, JsonResponse({'error': 'Nombre de categoría no reconocido'}, status=400)


def movements_in_category(name):
    # ponytail: scan distinct legacy labels; use a normalized column if the catalog grows large.
    labels = Movement.objects.order_by().values_list('category', flat=True).distinct()
    return Movement.objects.filter(category__in=[label for label in labels if label.strip() == name])


@ensure_csrf_cookie
def list_movements(request):
    movements = list(Movement.objects.values(
        'id', 'date', 'description', 'amount', 'balance', 'category',
    ))
    for movement in movements:
        movement['category'] = movement['category'].strip()
    return JsonResponse(movements, safe=False)


def update_category(request, movement_id):
    if request.method != 'PATCH':
        return JsonResponse({'error': 'Usa PATCH para actualizar una categoría'}, status=405)
    payload, error = json_payload(request)
    if error:
        return error
    try:
        name = catalog_name(payload.get('category'))
    except ValueError:
        return JsonResponse({'error': 'Categoría no reconocida'}, status=400)
    with transaction.atomic():
        category = Category.objects.select_for_update().filter(name=name).first()
        if category is None:
            return JsonResponse({'error': 'Categoría no reconocida'}, status=400)
        movement = get_object_or_404(Movement.objects.select_for_update(), id=movement_id)
        movement.category = category.name
        movement.save(update_fields=['category'])
        return JsonResponse({'id': movement.id, 'category': movement.category})


def categories(request):
    if request.method == 'GET':
        return JsonResponse(list(Category.objects.values('id', 'name')), safe=False)
    if request.method != 'POST':
        return JsonResponse({'error': 'Usa GET o POST para categorías'}, status=405)
    payload, error = json_payload(request)
    if error:
        return error
    name, error = category_name(payload)
    if error:
        return error
    try:
        category = Category.objects.create(name=name)
    except IntegrityError:
        return JsonResponse({'error': 'Nombre de categoría no reconocido'}, status=400)
    return JsonResponse({'id': category.id, 'name': category.name}, status=201)


def category_detail(request, category_id):
    if request.method not in ('PATCH', 'DELETE'):
        return JsonResponse({'error': 'Usa PATCH o DELETE para categorías'}, status=405)
    payload, error = json_payload(request)
    if error:
        return error
    try:
        with transaction.atomic():
            category = get_object_or_404(Category.objects.select_for_update(), id=category_id)
            if request.method == 'PATCH':
                name, error = category_name(payload)
                if error:
                    return error
                old_name = category.name
                category.name = name
                category.save()
                movements_in_category(old_name).update(category=name)
                return JsonResponse({'id': category.id, 'name': category.name})
            replacement_id = payload.get('replacement_id')
            if type(replacement_id) is not int:
                return JsonResponse({'error': 'Categoría de reemplazo no reconocida'}, status=400)
            replacement = Category.objects.select_for_update().filter(id=replacement_id).first()
            if replacement is None or replacement.id == category.id:
                return JsonResponse({'error': 'Categoría de reemplazo no reconocida'}, status=400)
            movements_in_category(category.name).update(category=replacement.name)
            deleted = category.id
            category.delete()
    except IntegrityError:
        return JsonResponse({'error': 'Nombre de categoría no reconocido'}, status=400)
    return JsonResponse({'deleted': deleted})


def parse_upload(upload):
    extension = upload.name.lower()
    parser = parse_xlsx if extension.endswith('.xlsx') else parse_xls if extension.endswith('.xls') else parse_pdf if extension.endswith('.pdf') else None
    if parser is None:
        raise ValueError('Formato no reconocido')
    return parser(upload)


def preview_imports(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Usa POST para previsualizar archivos'}, status=405)
    results = []
    for upload in request.FILES.getlist('files'):
        try:
            records = parse_upload(upload)
            rows = [
                {**record, 'date': record['date'].isoformat()}
                for record in records[:100]
            ]
            results.append({'name': upload.name, 'total': len(records), 'rows': rows, 'error': ''})
        except ValueError as error:
            results.append({'name': upload.name, 'total': 0, 'rows': [], 'error': str(error)})
    return JsonResponse({'files': results})


def import_movements(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Usa POST para importar archivos'}, status=405)
    results = []
    for upload in request.FILES.getlist('files'):
        try:
            imported, skipped = store_records(parse_upload(upload))
            results.append({'name': upload.name, 'imported': imported, 'skipped': skipped, 'error': ''})
        except ValueError as error:
            results.append({'name': upload.name, 'imported': 0, 'skipped': 0, 'error': str(error)})
    return JsonResponse({'files': results})

# Create your views here.
