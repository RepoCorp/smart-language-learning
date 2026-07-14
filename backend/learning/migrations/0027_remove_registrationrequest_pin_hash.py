from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0026_registrationrequest"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="registrationrequest",
            name="pin_hash",
        ),
    ]
