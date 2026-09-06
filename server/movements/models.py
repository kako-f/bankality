from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=80, unique=True)

    class Meta:
        ordering = ['name']


class Movement(models.Model):
    date = models.DateField()
    description = models.CharField(max_length=255)
    amount = models.BigIntegerField()
    balance = models.BigIntegerField()
    category = models.CharField(max_length=80)
    fingerprint = models.CharField(max_length=64, unique=True)

    class Meta:
        ordering = ['date', 'id']

# Create your models here.
