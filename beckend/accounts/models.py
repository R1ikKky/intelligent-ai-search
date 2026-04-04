from django.db import models


class Customer(models.Model):
    customer_inn = models.TextField(primary_key=True)
    customer_name = models.TextField()
    customer_region = models.TextField()

    class Meta:
        managed = False
        db_table = "customer"
