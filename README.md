# Lampa Rutube Plugin (rutube.js)

[![Lampa Plugin](https://img.shields.io/badge/Lampa-Plugin-orange?style=for-the-badge&logo=lampa)](https://lampa.dev)
[![Rutube API](https://img.shields.io/badge/Rutube-API-red?style=for-the-badge&logo=rutube)](https://rutube.ru)
[![Platforms](https://img.shields.io/badge/Platforms-Smart%20TV%20%7C%20Android%20TV%20%7C%20Web-blue?style=for-the-badge)](https://github.com/Sophiedevops/lampa-rutube-plugin)

Полнофункциональный плагин для интеграции **RuTube** в медиацентр **Lampa**. Поддерживает навигацию по каталогу, поиск, историю, сохранение прогресса просмотра и интеллектуальный выбор плеера в зависимости от платформы.

---

## ✨ Возможности

### 📺 Главный экран — 13 полок контента
*   **Популярное**, **Фильмы**, **Новые фильмы**, **Сериалы**, **Мультфильмы**, **Аниме**
*   **Блогеры**, **Музыка**, **Юмор**, **Спорт**, **Наука**, **Игры**, **Авто**

### 🔍 Поиск и История
*   Полнотекстовый поиск по RuTube (`nosave: true`, `keyboard: 'lampa'`).
*   История просмотров с сохранением позиции.

### ♾️ Бесконечная прокрутка
*   Загрузка до **1000 страниц** на полку.
*   Дедупликация через `seenIds` — никаких дублей при доскролле через кнопку **«Еще»**.

### 📱 Адаптивное воспроизведение (TV / Desktop)
*   **Smart TV / Android TV:** Автоматическое определение через `Lampa.Platform` & `Lampa.Storage.get('platform')`. Запуск напрямую в плеере, выбранном в настройках Lampa (**`Настройки → Плеер`** — Vimu, Just Player, VLC, Android и др.). Корректная обработка HLS плейлистов без запятых (`river-*.rtbcdn.ru` + резервный CDN `url_reserve`).
*   **Desktop Browser:** Поддержка переключения между плеером Lampa и встроенной WatchPage Rutube с защитой от двойного аудио (`killFrame()`).

### ⚙️ Дополнительно
*   Сохранение прогресса воспроизведения (`Просмотрено X%` / `✓ Просмотрено`).
*   Кэширование потоков на 20 минут.
*   Поддержка 4 языков (`ru`, `uk`, `en`, `be`).
*   Строгая совместимость со стандартом **ES5** для работы на старых телевизорах и приставках.

---

## 📲 Установка в Lampa (Ссылки для подключения)

Чтобы установить плагин, скопируйте одну из ссылок и добавьте её в Lampa:
**Настройки ⚙️ → Расширения → Добавить плагин**

1. **Вариант 1 (Githack CDN — рекомендуемый):**
   ```text
   https://raw.githack.com/Sophiedevops/lampa-rutube-plugin/main/rutube.js
   ```

2. **Вариант 2 (Statically CDN — резервный):**
   ```text
   https://cdn.statically.io/gh/Sophiedevops/lampa-rutube-plugin@main/rutube.js
   ```

3. **Вариант 3 (GitHub Raw):**
   ```text
   https://raw.githubusercontent.com/Sophiedevops/lampa-rutube-plugin/main/rutube.js
   ```

---

## 🚀 Быстрый старт

1. Откройте медиацентр **Lampa**.
2. Перейдите в **Настройки ⚙️** → **Расширения**.
3. Нажмите кнопку **Добавить плагин**.
4. Вставьте любую из ссылок на `rutube.js` и нажмите **Сохранить** (или **Применить**).
5. Перезапустите Lampa, после чего в главном меню появится раздел **RuTube**.
