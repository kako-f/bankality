from django.test import TestCase

from movements.models import Movement


class MovementApiTests(TestCase):
    def test_lists_movements_in_date_order(self):
        Movement.objects.create(
            date='2026-09-02', description='Compra', amount=-2200,
            balance=3308103, category='Compras', fingerprint='second',
        )
        Movement.objects.create(
            date='2026-09-01', description='Abono', amount=1000,
            balance=3310303, category='Otros abonos', fingerprint='first',
        )

        response = self.client.get('/api/movements')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['date'] for item in response.json()], ['2026-09-01', '2026-09-02'])
