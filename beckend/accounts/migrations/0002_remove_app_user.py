# Generated manually

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial_app_user"),
    ]

    operations = [
        migrations.DeleteModel(name="AppUser"),
    ]
