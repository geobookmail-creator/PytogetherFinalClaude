"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

from django.conf import settings
from django.conf.urls.static import static

from apps.accounts.views import LoginPageView

from rest_framework_simplejwt.views import (

    TokenRefreshView,

)

urlpatterns = [
    path('admin/', admin.site.urls),

    # Authentication is stored in the browser (JWTs in localStorage), so the
    # login page performs the final client-side decision: visitors without a
    # token see the form and signed-in visitors are sent to their dashboard.
    path('', LoginPageView.as_view(), name='home'),
    
    path('', include('apps.accounts.urls', namespace='accounts')),

    path('', include('apps.tours.urls', namespace='tours')),

    path('', include('apps.tours.page_urls', namespace='tours-page')),

    path('', include('apps.expenses.urls', namespace='expenses')),

    path('', include('apps.reports.urls', namespace='reports')),

    path('', include('apps.payments.urls', namespace='payments')),

    path(

    "api/token/refresh/",

    TokenRefreshView.as_view(),

    name="token_refresh",

),
]

if settings.DEBUG or settings.SERVE_MEDIA:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )
