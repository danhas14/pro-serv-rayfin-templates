FROM mcr.microsoft.com/playwright/python:v1.55.0-noble

# ODBC driver for Fabric SQL — not in the Playwright base image
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl gnupg \
 && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/microsoft.gpg] https://packages.microsoft.com/ubuntu/24.04/prod noble main" > /etc/apt/sources.list.d/mssql-release.list \
 && apt-get update \
 && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 unixodbc \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY core.py main.py scheduler.py ./

# Browser automation runs generated scripts; keep it off root.
# pwuser ships with the Playwright base image and owns the browser bundles.
USER pwuser

EXPOSE 8000
# The scheduler job overrides this with: python scheduler.py
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
