import uuid

from django.db import migrations, models


def populate_host_tokens(apps, schema_editor):
    Meeting = apps.get_model('meetings', 'Meeting')
    for meeting in Meeting.objects.filter(host_access_token__isnull=True).iterator():
        meeting.host_access_token = uuid.uuid4()
        meeting.save(update_fields=['host_access_token'])


class Migration(migrations.Migration):
    dependencies = [
        ('meetings', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='meeting',
            name='host_access_token',
            field=models.UUIDField(null=True, editable=False),
        ),
        migrations.RunPython(populate_host_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='meeting',
            name='host_access_token',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
