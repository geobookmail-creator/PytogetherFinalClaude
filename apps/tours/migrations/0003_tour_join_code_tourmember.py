# Generated manually to give existing tours distinct join codes.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import apps.tours.models


JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def populate_join_codes(apps, schema_editor):
    Tour = apps.get_model("tours", "Tour")
    from django.utils.crypto import get_random_string

    for tour in Tour.objects.filter(join_code__isnull=True).iterator():
        join_code = get_random_string(8, JOIN_CODE_ALPHABET)
        while Tour.objects.filter(join_code=join_code).exists():
            join_code = get_random_string(8, JOIN_CODE_ALPHABET)
        tour.join_code = join_code
        tour.save(update_fields=["join_code"])


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tours", "0002_tour_image"),
    ]

    operations = [
        migrations.AddField(
            model_name="tour",
            name="join_code",
            field=models.CharField(blank=True, max_length=8, null=True),
        ),
        migrations.RunPython(populate_join_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="tour",
            name="join_code",
            field=models.CharField(
                default=apps.tours.models.generate_join_code,
                editable=False,
                max_length=8,
                unique=True,
            ),
        ),
        migrations.CreateModel(
            name="TourMember",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("joined_at", models.DateTimeField(auto_now_add=True)),
                ("tour", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="members", to="tours.tour")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="joined_tour_memberships", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-joined_at"]},
        ),
        migrations.AddConstraint(
            model_name="tourmember",
            constraint=models.UniqueConstraint(fields=("tour", "user"), name="unique_tour_member"),
        ),
    ]
