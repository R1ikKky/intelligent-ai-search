from pathlib import Path

from django.db import migrations


def repair_customer_schema(apps, schema_editor):
    path = Path(__file__).resolve().parent.parent / "sql" / "repair_customer_schema.sql"
    sql = path.read_text(encoding="utf-8")
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(sql)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_remove_app_user"),
    ]

    operations = [
        migrations.RunPython(repair_customer_schema, migrations.RunPython.noop),
    ]
