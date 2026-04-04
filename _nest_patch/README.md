# `_nest_patch` — локальные патчи NestJS (`backend/`)

Каталог находится **внутри** репозитория `intelligent-ai-search`. Сюда складываются unified-diff файлы (`.patch`), которые нужно применить к дереву **`backend/`** без выноса артефактов за пределы проекта.

## Зачем

- Быстрые правки или эксперименты, оформленные как патчи.
- Повторяемое применение одинаковых изменений на чистой ветке.
- Всё, что относится к Nest, остаётся привязанным к корню монорепозитория.

## Макет

```
_nest_patch/
├── README.md           # этот файл
├── apply.ps1           # применить все patches/*.patch к backend/
├── record-patch.ps1    # записать текущий git diff backend/ в новый .patch
└── patches/            # сюда кладутся *.patch (пути внутри патча — относительно backend/)
```

## Создать патч

Из каталога `backend/` с незакоммиченными изменениями:

```powershell
cd intelligent-ai-search\backend
..\_nest_patch\record-patch.ps1 -Name fix-auth-header
```

Появится файл `_nest_patch/patches/fix-auth-header.patch`.

Вручную:

```powershell
cd intelligent-ai-search\backend
git diff > ..\_nest_patch\patches\my-fix.patch
```

Убедитесь, что в патче пути вида `src/...`, а не `backend/src/...` (дифф должен быть сгенерирован из `backend`).

## Применить патчи

Из корня `intelligent-ai-search`:

```powershell
.\_nest_patch\apply.ps1
```

Скрипт по алфавиту применяет каждый `patches/*.patch` командой `git apply` с рабочей директорией `backend/`.

## Важно

- Патчи **не подставляются автоматически** при `npm run build` или Docker — только по явному запуску `apply.ps1` (или ручному `git apply`).
- Не коммитьте секреты в `.patch`.
- После успешного переноса изменений в основной код патч можно удалить из `patches/`, чтобы не дублировать историю.
