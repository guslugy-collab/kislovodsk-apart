#!/bin/bash
# Кладёт ZIP ТОЛЬКО с кодом (git archive, без node_modules/секретов) в Google Диск.
# Имя проекта берётся автоматически из имени папки репозитория — править не нужно.
# Запуск:  bash scripts/backup-to-drive.sh [метка]      Пример: bash scripts/backup-to-drive.sh M6
set -e

# корень репозитория (или папка скрипта, если git нет)
cd "$(git rev-parse --show-toplevel 2>/dev/null || dirname "$0")"
PROJECT=$(basename "$(pwd)")

# найти папку Google Диска (локали: "My Drive" и "Мой диск")
DRIVE=""
for base in ~/Library/CloudStorage/GoogleDrive-*; do
  for sub in "My Drive" "Мой диск"; do
    [ -d "$base/$sub" ] && DRIVE="$base/$sub" && break 2
  done
done
if [ -z "$DRIVE" ]; then
  echo "✗ Папка Google Диска не найдена."
  echo "  Установите «Google Drive для компьютера» и войдите:"
  echo "  https://www.google.com/drive/download/"
  echo "  (если только что установили — подождите окончания первой синхронизации)"
  exit 1
fi

# страховка: .env не должен быть в git (иначе попадёт в архив)
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "⚠️ ОПАСНО: .env отслеживается git и попадёт в бэкап! Добавьте .env в .gitignore и сделайте git rm --cached .env"
  exit 1
fi

DEST="$DRIVE/Проекты/$PROJECT"; mkdir -p "$DEST"
LABEL="${1:-$(git rev-parse --short HEAD)}"
NAME="${PROJECT}_${LABEL}_$(date +%Y-%m-%d_%H%M).zip"
git archive --format=zip -o "$DEST/$NAME" HEAD

echo "✓ Копия в Google Диск: Проекты/$PROJECT/$NAME"
ls -lh "$DEST/$NAME" 2>/dev/null | awk '{print "  размер:", $5}'
