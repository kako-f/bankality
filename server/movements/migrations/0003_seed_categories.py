from django.db import migrations


DEFAULT_CATEGORIES = (
    'Arriendo', 'Supermercado', 'Transporte', 'Cuentas', 'Comida',
    'Transferencia', 'T. Crédito', 'Salud', 'Ocio', 'Otros',
)


def catalog_name(value):
    value = value.strip()
    return value if 1 <= len(value) <= 80 else None


def seed_categories(apps, schema_editor):
    Movement = apps.get_model('movements', 'Movement')
    Category = apps.get_model('movements', 'Category')

    for name in (*Movement.objects.values_list('category', flat=True).distinct(), *DEFAULT_CATEGORIES):
        if name := catalog_name(name):
            Category.objects.get_or_create(name=name)


class Migration(migrations.Migration):

    dependencies = [
        ('movements', '0002_category'),
    ]

    operations = [
        migrations.RunPython(seed_categories, migrations.RunPython.noop),
    ]
