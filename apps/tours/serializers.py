from django.db.models import Sum
from rest_framework import serializers
from .models import Tour


class TourSerializer(serializers.ModelSerializer):

    is_owner = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    total_expense = serializers.SerializerMethodField()

    class Meta:
        model = Tour

        # 
        
        fields = "__all__"

        read_only_fields = [
            "id",
            "created_by",
            "join_code",
            "created_at",
            "updated_at",
        ]

    def get_is_owner(self, tour):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and tour.created_by_id == request.user.id)

    def get_member_count(self, tour):
        # Members joined via the invite link, plus the tour creator.
        return tour.members.count() + 1

    def get_total_expense(self, tour):
        total = tour.expenses.aggregate(total=Sum("amount"))["total"]
        return str(total or "0.00")

    def validate_image(self, image):

        max_size = 5 * 1024 * 1024


        if image.size > max_size:

            raise serializers.ValidationError(
                "Image size must not exceed 5 MB."
            )
        return image

    def validate(self, attrs):

        if attrs["end_date"] < attrs["start_date"]:

            raise serializers.ValidationError(
                {
                    "end_date":
                    "End date cannot be earlier than start date."
                }
            )

        if attrs["budget"] < 0:

            raise serializers.ValidationError(
                {
                    "budget":
                    "Budget cannot be negative."
                }
            )

        return attrs
