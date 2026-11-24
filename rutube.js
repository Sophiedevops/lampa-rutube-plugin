(function () {
    'use strict';

    if (window.rutube_plugin) return;

    window.rutube_plugin = true;

    // Полифиллы безопасной работы селекторов в ядре Lampa
    var polyMethods = ['toggleClass', 'removeClass', 'addClass', 'hasClass'];
    polyMethods.forEach(function (method) {
        if (typeof Object.prototype[method] !== 'function') {
            try {
                Object.defineProperty(Object.prototype, method, {
                    value: function (classes, status) {
                        if (this && this.classList) {
                            var el = this;
                            (classes || '').split(' ').forEach(function (c) {
                                if (!c) return;
                                var has = el.classList.contains(c);
                                if (method === 'toggleClass') {
                                    if (status && !has) el.classList.add(c);
                                    else if (!status && has) el.classList.remove(c);
                                } else if (method === 'addClass') {
                                    el.classList.add(c);
                                } else if (method === 'removeClass') {
                                    el.classList.remove(c);
                                }
                            });
                            if (method === 'hasClass') {
                                return el.classList.contains(classes);
                            }
                        }
                        return method === 'hasClass' ? false : this;
                    },
                    writable: true,
                    configurable: true,
                    enumerable: false
                });
            } catch (e) {}
        }
    });

    var SITE = 'https://rutube.ru';
    var API = 'https://rutube.ru/api/';
    var EMBED_URL = 'https://rutube.ru/play/embed/';
    var PLAYER_ORIGIN = 'https://rutube.ru';
    var MENU_TITLE = 'Rutube';
    var HISTORY_SOURCE = 'rutube';
    var HISTORY_SIZE = 20;
    var REQ_TIMEOUT = 8000;
    var ANDROID_GUARD_MS = 6500;
    var THROTTLE_MS = 260;
    var RESOLVE_TTL = 20 * 60 * 1000;
    var PROGRESS_KEY = 'rutube_progress';
    var SHELVES_PER_BATCH = 3;
    var PAGE_SIZE = 20;
    var MAX_EMPTY_HOPS = 5;

    var PROXIES = [
        {
            build: function (u) { return 'https://r.jina.ai/' + u; },
            headers: {'X-Return-Format': 'text'}
        },
        {
            build: function (u) { return 'https://r.jina.ai/' + u; },
            unwrapJina: true
        },
        {
            build: function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); }
        },
        {
            build: function (u) { return 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u); }
        }
    ];

    // Полки каталога: каждая имеет кнопку «Еще»
    var SHELVES = [
        {key: 'rutube_sh_fresh', fb: 'Свежее', url: function (p) { return API + 'video/list/public/?page=' + p + '&limit=20&sort=publication_d'; }},
        {key: 'rutube_sh_bloggers', fb: 'Новинки блогеров', url: function (p) { return API + 'tags/video/6050/?sort=publication_d&page=' + p + '&limit=20'; }},
        {key: 'rutube_sh_cinema_new', fb: 'Новинки кино', url: function (p) { return API + 'tags/video/8151/?sort=tagged_d&page=' + p + '&limit=20'; }},
        {key: 'rutube_sh_movies', fb: 'Фильмы', url: function (p) { return API + 'video/category/4/?page=' + p + '&limit=20'; }},
        {key: 'rutube_sh_series', fb: 'Сериалы', url: function (p) { return API + 'video/category/5/?page=' + p + '&limit=20'; }},
        {key: 'rutube_sh_tv', fb: 'Телепередачи', url: function (p) { return API + 'video/category/43/?page=' + p + '&limit=20'; }},
        {key: 'rutube_sh_cartoons', fb: 'Мультфильмы', url: function (p) { return API + 'video/category/7/?page=' + p + '&limit=20'; }},
        {key: 'rutube_sh_sport', fb: 'Спорт', url: function (p) { return API + 'video/category/16/?page=' + p + '&limit=20'; }},
        {key: 'rutube_sh_games', fb: 'Видеоигры', url: function (p) { return API + 'video/category/22/?page=' + p + '&limit=20'; }},
        {key: 'rutube_sh_music', fb: 'Музыка', url: function (p) { return API + 'video/category/6/?page=' + p + '&limit=20'; }},
        {key: 'rutube_sh_humor', fb: 'Юмор', url: function (p) { return API + 'video/category/19/?page=' + p + '&limit=20'; }},
        {key: 'rutube_sh_tech', fb: 'Технологии', url: function (p) { return API + 'video/category/45/?page=' + p + '&limit=20'; }},
        {key: 'rutube_sh_science', fb: 'Наука', url: function (p) { return API + 'video/category/52/?page=' + p + '&limit=20'; }}
    ];

    var ICON_MENU = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4.5" width="19" height="15" rx="4.5" stroke="currentColor" stroke-width="2"/><path d="M10 9.27v5.46c0 .46.5.75.9.52l4.73-2.73a.6.6 0 0 0 0-1.04L10.9 8.75a.6.6 0 0 0-.9.52z" fill="currentColor"/></svg>';
    var ICON_SEARCH = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>';
    var ICON_PLAY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

    var STYLE = [
        '.items-line .card--rutube { width: 21em; }',
        '.card--rutube .card__view { padding-bottom: 56.25%; margin-bottom: 0.7em; }',
        '.card--rutube .card__img { object-fit: cover; }',
        '.card--rutube .card__title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; max-height: 2.6em; }',
        '.card--rutube .card__age { margin-top: 0.35em; font-size: 0.9em; opacity: 0.55; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
        '.card__rutube-badge { position: absolute; right: 0.6em; bottom: 0.6em; padding: 0.2em 0.45em; border-radius: 0.4em; background: rgba(0, 0, 0, 0.75); font-size: 0.85em; font-weight: 600; line-height: 1.2; }',
        '.card__rutube-badge--live { background: #ff3347; }',
        '.card__rutube-progress { position: absolute; left: 0.6em; top: 0.6em; padding: 0.2em 0.45em; border-radius: 0.4em; background: rgba(20, 100, 245, 0.9); font-size: 0.8em; font-weight: 600; line-height: 1.2; color: #fff; z-index: 2; pointer-events: none; }',
        '.card__rutube-progress--done { background: rgba(0, 0, 0, 0.75); }',
        '.card--rutube-search .card__view { background: rgba(255, 255, 255, 0.08); }',
        '.card--rutube-search svg { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 3em; height: 3em; opacity: 0.8; }',
        '.card--rutube-search .card__age { display: none !important; }',
        '@media screen and (max-width: 480px) { .items-line .card--rutube { width: 18em; } }',

        '.rutube-watch { padding: 0 1.5em 3em; }',
        '.rutube-watch__inner { margin: 0 auto; }',
        '.rutube-watch__buttons { display: flex; gap: 0.8em; margin-bottom: 0.8em; }',
        '.rutube-watch__back, .rutube-watch__native { margin-bottom: 0; }',
        '@media screen and (min-width: 768px) and (min-height: 480px) { .rutube-watch__inner { max-width: calc((100vh - 17em) * 1.7778); } }',
        '.rutube-watch__player { position: relative; padding-top: 56.25%; background: #000; border-radius: 1em; overflow: hidden; }',
        '.rutube-watch__player.focus { box-shadow: 0 0 0 0.2em #fff; }',
        '.rutube-watch__player iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }',
        '.rutube-watch__title { margin-top: 0.8em; font-size: 1.6em; font-weight: 600; line-height: 1.3; }',
        '.rutube-watch__stats { margin-top: 0.4em; color: rgba(255, 255, 255, 0.6); }',
        '.rutube-watch__channel { display: flex; align-items: center; margin: 1.2em -0.8em 0; padding: 0.6em 0.8em; border-radius: 1em; }',
        '.rutube-watch__channel.focus { background: rgba(255, 255, 255, 0.14); }',
        '.rutube-watch__avatar { flex-shrink: 0; width: 3em; height: 3em; margin-right: 0.9em; border-radius: 50%; background: rgba(255, 255, 255, 0.1) center / cover no-repeat; }',
        '.rutube-watch__channel-name { font-size: 1.15em; font-weight: 600; }',
        '.rutube-watch__channel-sub { margin-top: 0.2em; font-size: 0.9em; color: rgba(255, 255, 255, 0.5); }',
        '.rutube-watch__desc { margin: 1.2em -0.8em 0; padding: 0.8em; border-radius: 1em; background: rgba(255, 255, 255, 0.06); }',
        '.rutube-watch__desc.focus { background: rgba(255, 255, 255, 0.14); }',
        '.rutube-watch__desc-text { white-space: pre-line; word-wrap: break-word; line-height: 1.45; max-height: 4.35em; overflow: hidden; }',
        '.rutube-watch__desc.expanded .rutube-watch__desc-text { max-height: none; }',
        '.rutube-watch__desc-toggle { margin-top: 0.4em; font-weight: 600; }',
        '.rutube-watch__note { margin-top: 1em; color: rgba(255, 255, 255, 0.5); }',
        '@media screen and (max-width: 767px) { .rutube-watch { padding: 0 0 3em; } .rutube-watch__buttons { margin: 0 1em 0.8em; } .rutube-watch__player { border-radius: 0; } .rutube-watch__body { padding: 0 1em; } .rutube-watch__title { font-size: 1.35em; } }'
    ].join('\n');

    var card_modules = null;
    var api_queue = [];
    var api_busy = false;
    var api_last_ts = 0;
    var resolve_cache = {};
    var progress_timer = null;
    var progress_ctx = null;
    var play_lock_until = 0;
    var player_listener_bound = false;

    function L(ru, uk, en, be) {
        return {ru: ru, uk: uk, en: en, be: be};
    }

    var LANG = {
        rutube_title: L('Rutube', 'Rutube', 'Rutube', 'Rutube'),
        rutube_player_mode_name: L('Плеер для Rutube', 'Плеєр для Rutube', 'Rutube Player', 'Плэер для Rutube'),
        rutube_mode_direct: L('Плеер Lampa (из Настройки → Плеер)', 'Плеєр Lampa (з Налаштування → Плеєр)', 'Lampa Player (from Settings → Player)', 'Плэер Lampa (з Налады → Плэер)'),
        rutube_mode_watch: L('Плеер Rutube (страница с описанием)', 'Плеєр Rutube (сторінка з описом)', 'Rutube Player (page with description)', 'Плэер Rutube (старонка з апісаннем)'),
        rutube_mode_descr: L(
            'Основной плеер выбирается в «Настройки → Плеер» (сейчас: {player}). Здесь переключается только запуск в плеере Lampa или на странице Rutube.',
            'Основний плеєр вибирається в «Налаштування → Плеєр» (зараз: {player}). Тут перемикається лише запуск у плеєрі Lampa або на сторінці Rutube.',
            'Main player is chosen in Settings → Player (current: {player}). This only switches between Lampa player and Rutube page.',
            'Асноўны плэер выбіраецца ў «Налады → Плэер» (зараз: {player}). Тут пераключаецца толькі запуск у плэеры Lampa ці на старонцы Rutube.'
        ),
        rutube_player_inner: L('Встроенный', 'Вбудований', 'Built-in', 'Убудаваны'),
        rutube_player_android: L('Android (внешний)', 'Android (зовнішній)', 'Android (external)', 'Android (знешні)'),
        rutube_quality_name: L('Приоритетное качество', 'Пріоритетна якість', 'Preferred quality', 'Прыярытэтная якасць'),
        rutube_quality_descr: L(
            'Используется для плеера Lampa и внешних плееров (Vimu, Just Player)',
            'Використовується для плеєра Lampa та зовнішніх плеєрів (Vimu, Just Player)',
            'Used for Lampa player and external players (Vimu, Just Player)',
            'Выкарыстоўваецца для плэера Lampa і знешніх плэераў (Vimu, Just Player)'
        ),
        rutube_quality_descr_tv: L(
            'Плеер выбирается в «Настройки → Плеер» (сейчас: {player}). Приоритетное качество для плеера Lampa и внешних плееров.',
            'Плеєр вибирається в «Налаштування → Плеєр» (зараз: {player}). Пріоритетна якість для плеєра Lampa та зовнішніх плеєрів.',
            'Player is chosen in Settings → Player (current: {player}). Preferred quality for Lampa player and external players.',
            'Плэер выбіраецца ў «Налады → Плэер» (зараз: {player}). Прыярытэтная якасць для плэера Lampa і знешніх плэераў.'
        ),
        rutube_quality_auto: L('Авто (HLS)', 'Авто (HLS)', 'Auto (HLS)', 'Аўта (HLS)'),
        rutube_search_shelf: L('Поиск по Rutube', 'Пошук у Rutube', 'Search Rutube', 'Пошук па Rutube'),
        rutube_search_card: L('Поиск видео', 'Пошук відео', 'Search videos', 'Пошук відэа'),
        rutube_search_input: L('Поиск в Rutube', 'Пошук у Rutube', 'Search in Rutube', 'Пошук у Rutube'),
        rutube_search_prefix: L('Поиск: ', 'Пошук: ', 'Search: ', 'Пошук: '),
        rutube_recommended: L('Рекомендации', 'Рекомендації', 'Recommended', 'Рэкамендацыі'),
        rutube_history: L('История просмотра', 'Історія перегляду', 'Watch history', 'Гісторыя прагляду'),
        rutube_live: L('Эфир', 'Ефір', 'Live', 'Эфір'),
        rutube_watched: L('Просмотрено', 'Переглянуто', 'Watched', 'Прагледжана'),
        rutube_watched_done: L('✓ Просмотрено', '✓ Переглянуто', '✓ Watched', '✓ Прагледжана'),
        rutube_back: L('Назад', 'Назад', 'Back', 'Назад'),
        rutube_play_native: L('Воспроизвести (Плеер)', 'Відтворити (Плеєр)', 'Play (Player)', 'Прайграць (Плэер)'),
        rutube_show_more_desc: L('Показать полностью', 'Показати повністю', 'Show more', 'Паказаць цалкам'),
        rutube_collapse_desc: L('Свернуть', 'Згорнути', 'Show less', 'Згарнуць'),
        rutube_unavailable: L('Видео недоступно', 'Відео недоступне', 'Video unavailable', 'Відэа недаступна'),
        rutube_direct_unavailable: L(
            'Rutube: прямой поток недоступен, открыт плеер Rutube',
            'Rutube: прямий потік недоступний, відкрито плеєр Rutube',
            'Rutube: direct stream unavailable, opening Rutube player',
            'Rutube: прамы паток недаступны, адкрыты плэер Rutube'
        ),
        rutube_direct_unavailable_tv: L(
            'Rutube: прямой поток недоступен для этого видео',
            'Rutube: прямий потік недоступний для цього відео',
            'Rutube: direct stream unavailable for this video',
            'Rutube: прамы паток недаступны для гэтага відэа'
        ),
        rutube_no_connection: L('Нет связи с Rutube', 'Немає зв’язку з Rutube', 'No connection to Rutube', 'Няма сувязі з Rutube'),
        rutube_timeout: L('Rutube не отвечает', 'Rutube не відповідає', 'Rutube is not responding', 'Rutube не адказвае'),
        rutube_open_channel: L('Все видео канала', 'Усі відео каналу', 'All channel videos', 'Усе відэа канала'),
        rutube_sh_fresh: L('Свежее', 'Свіже', 'Fresh', 'Свежае'),
        rutube_sh_bloggers: L('Новинки блогеров', 'Новинки блогерів', 'New from bloggers', 'Навінкі блогераў'),
        rutube_sh_cinema_new: L('Новинки кино', 'Новинки кіно', 'New movies', 'Навінкі кіно'),
        rutube_sh_movies: L('Фильмы', 'Фільми', 'Movies', 'Фільмы'),
        rutube_sh_series: L('Сериалы', 'Серіали', 'Series', 'Серыялы'),
        rutube_sh_tv: L('Телепередачи', 'Телепередачі', 'TV shows', 'Тэлеперадачы'),
        rutube_sh_cartoons: L('Мультфильмы', 'Мультфільми', 'Cartoons', 'Мультфільмы'),
        rutube_sh_sport: L('Спорт', 'Спорт', 'Sport', 'Спорт'),
        rutube_sh_games: L('Видеоигры', 'Відеоігри', 'Video games', 'Відэагульні'),
        rutube_sh_music: L('Музыка', 'Музика', 'Music', 'Музыка'),
        rutube_sh_humor: L('Юмор', 'Гумор', 'Humor', 'Гумар'),
        rutube_sh_tech: L('Технологии', 'Технології', 'Technology', 'Тэхналогіі'),
        rutube_sh_science: L('Наука', 'Наука', 'Science', 'Навука')
    };

    function initLang() {
        if (window.Lampa && Lampa.Lang && typeof Lampa.Lang.add === 'function') {
            Lampa.Lang.add(LANG);
        }
    }

    function tr(key, fallback) {
        if (window.Lampa && Lampa.Lang && typeof Lampa.Lang.translate === 'function') {
            var translated = Lampa.Lang.translate(key);

            if (translated && translated !== key) return translated;
        }

        var lang = 'ru';

        if (window.Lampa && Lampa.Storage) {
            lang = typeof Lampa.Storage.field === 'function' ? Lampa.Storage.field('language') : Lampa.Storage.get('language', 'ru');
        }

        lang = String(lang || 'ru').toLowerCase().slice(0, 2);

        var entry = LANG[key];

        if (entry) return entry[lang] || entry.ru || fallback || key;

        return fallback || key;
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function plural(n, one, few, many) {
        var mod10 = n % 10;
        var mod100 = n % 100;

        if (mod10 === 1 && mod100 !== 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;

        return many;
    }

    function shortNumber(n) {
        function trim(x) {
            return String(x >= 100 ? Math.floor(x) : Math.floor(x * 10) / 10).replace('.', ',');
        }

        if (n >= 1e6) return trim(n / 1e6) + ' млн';
        if (n >= 1e3) return trim(n / 1e3) + ' тыс.';

        return String(n || 0);
    }

    function countText(n, one, few, many) {
        return shortNumber(n) + ' ' + (n >= 1000 ? many : plural(n || 0, one, few, many));
    }

    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function formatDuration(sec) {
        sec = Math.floor(sec || 0);

        var h = Math.floor(sec / 3600);
        var m = Math.floor(sec % 3600 / 60);

        return (h ? h + ':' + pad(m) : m) + ':' + pad(sec % 60);
    }

    function formatDate(ts) {
        return ts ? new Date(ts * 1000).toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'}).replace(/\s*г\.$/, '') : '';
    }

    function parseTs(value) {
        if (!value) return 0;
        if (typeof value === 'number') return value > 1e11 ? Math.floor(value / 1000) : value;

        var t = Date.parse(String(value));

        return isNaN(t) ? 0 : Math.floor(t / 1000);
    }

    function notifyText(text) {
        if (window.Lampa && Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(text);
    }

    function notify(err) {
        notifyText(tr('rutube_title', MENU_TITLE) + ': ' + ((err && err.message) || err));
    }

    // ---------- Транспорт ----------

    function toText(res) {
        if (res == null) return '';
        if (typeof res === 'string') return res;

        try {
            return JSON.stringify(res);
        } catch (e) {
            return '';
        }
    }

    function isJsonText(text) {
        if (!text || typeof text !== 'string') return false;

        try {
            var data = JSON.parse(text);

            if (!data || typeof data !== 'object') return false;
            if (data.error && !data.results && !data.id && !data.video_balancer && !data.live_streams) return false;
            if (data.corsfix_error) return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    function unwrapJinaMarkdown(text) {
        if (!text || typeof text !== 'string') return '';
        var marker = 'Markdown Content:';
        var idx = text.indexOf(marker);
        var body = idx >= 0 ? text.slice(idx + marker.length).trim() : text.trim();
        body = body.replace(/\[(https?:\/\/[^\]"]+)\]\((https?:\/\/[^)"]+)\)/g, '$1');
        var firstBrace = body.indexOf('{');
        var lastBrace = body.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            return body.slice(firstBrace, lastBrace + 1);
        }
        return body;
    }

    function isM3u8Text(text) {
        return typeof text === 'string' && text.indexOf('#EXTM3U') >= 0;
    }

    // Цепочка: Lampa.Android.httpReq -> Lampa.Reguest.native -> прямой XHR -> CORS-прокси
    function requestRaw(url, callback, validate) {
        var steps = [];
        var finished = false;
        var androidWV = location.protocol === 'http:' && /Android/i.test(navigator.userAgent);
        var androidBridge = (window.AndroidJS && window.Lampa && Lampa.Android && typeof Lampa.Android.httpReq === 'function')
            ? Lampa.Android
            : ((window.Android && typeof window.Android.httpReq === 'function') ? window.Android : null);

        function done(err, text) {
            if (finished) return;
            finished = true;
            callback(err, text);
        }

        function accept(text) {
            return !!text && (!validate || validate(text));
        }

        function xhrStep(target, next, opts) {
            var xhr;
            var called = false;

            function fail() {
                if (called) return;
                called = true;
                next();
            }

            try {
                xhr = new XMLHttpRequest();
                xhr.open('GET', target);
                xhr.timeout = REQ_TIMEOUT;
                if (opts && opts.headers) {
                    for (var h in opts.headers) {
                        if (Object.prototype.hasOwnProperty.call(opts.headers, h)) {
                            xhr.setRequestHeader(h, opts.headers[h]);
                        }
                    }
                }
                xhr.onload = function () {
                    if (called) return;
                    if (xhr.status && (xhr.status < 200 || xhr.status >= 300)) {
                        return fail();
                    }
                    var text = xhr.responseText;
                    if (opts && opts.unwrapJina) {
                        text = unwrapJinaMarkdown(text);
                    }

                    if (accept(text)) {
                        called = true;
                        return done(null, text);
                    }

                    fail();
                };
                xhr.onerror = xhr.ontimeout = fail;
                xhr.send();
            } catch (e) {
                fail();
            }
        }

        function viaAndroid(next) {
            var fired = false;
            var timer;

            function step(text) {
                if (fired) return;
                fired = true;
                clearTimeout(timer);

                if (accept(text)) return done(null, text);
                next();
            }

            timer = setTimeout(function () {
                step('');
            }, ANDROID_GUARD_MS);

            try {
                androidBridge.httpReq({url: url, timeout: 6000, dataType: 'text'}, {
                    complite: function (res) {
                        step(toText(res));
                    },
                    error: function () {
                        step('');
                    }
                });
            } catch (e) {
                step('');
            }
        }

        function viaLampaNative(next) {
            var fired = false;
            var timer;

            function step(text) {
                if (fired) return;
                fired = true;
                clearTimeout(timer);

                if (accept(text)) return done(null, text);
                next();
            }

            timer = setTimeout(function () {
                step('');
            }, REQ_TIMEOUT + 500);

            try {
                var req = new Lampa.Reguest();

                req['native'](url, function (res) {
                    step(toText(res));
                }, function () {
                    step('');
                }, false, {dataType: 'text', timeout: REQ_TIMEOUT});
            } catch (e) {
                step('');
            }
        }

        function viaDirect(next) {
            xhrStep(url, next);
        }

        if (androidBridge) steps.push(viaAndroid);
        else if (window.Lampa && typeof Lampa.Reguest === 'function') steps.push(viaLampaNative);

        if (!androidWV) steps.push(viaDirect);

        if (!androidBridge) {
            PROXIES.forEach(function (entry) {
                steps.push(function (next) {
                    var buildFn = typeof entry === 'function' ? entry : entry.build;
                    var opts = typeof entry === 'object' ? entry : null;
                    xhrStep(buildFn(url), next, opts);
                });
            });
        }

        (function run() {
            var s = steps.shift();

            if (!s) return done(new Error(tr('rutube_no_connection', 'Нет связи с Rutube')));
            s(run);
        })();
    }

    function enqueueApi(taskFn) {
        api_queue.push(taskFn);
        runApiQueue();
    }

    function runApiQueue() {
        if (api_busy || !api_queue.length) return;

        api_busy = true;

        var wait = Math.max(0, THROTTLE_MS - (Date.now() - api_last_ts));

        setTimeout(function () {
            var task = api_queue.shift();
            var released = false;

            function releaseQueue() {
                if (released) return;
                released = true;
                api_last_ts = Date.now();
                api_busy = false;
                runApiQueue();
            }

            if (!task) {
                releaseQueue();
                return;
            }

            api_last_ts = Date.now();

            try {
                task(releaseQueue);
            } catch (e) {
                releaseQueue();
            }
        }, wait);
    }

    function apiGet(url, callback) {
        enqueueApi(function (releaseQueue) {
            requestRaw(url, function (err, text) {
                releaseQueue();

                if (err) return callback(err);

                var data = null;

                try {
                    data = JSON.parse(text);
                } catch (e) {}

                if (!data) return callback(new Error(tr('rutube_no_connection', 'Нет связи с Rutube')));

                callback(null, data);
            }, isJsonText);
        });
    }

    function textGet(url, callback) {
        enqueueApi(function (releaseQueue) {
            requestRaw(url, function (err, text) {
                releaseQueue();
                callback(err, text);
            }, isM3u8Text);
        });
    }

    // ---------- M3U8 ----------

    function stripQuery(url) {
        return String(url || '').split('#')[0].split('?')[0];
    }

    function resolveUrl(baseUrl, relativeUrl) {
        if (/^https?:\/\//i.test(relativeUrl)) return relativeUrl;

        var origin = baseUrl.match(/^(https?:)?(?:\/\/)?([^\/]+)/);

        if (relativeUrl.indexOf('//') === 0) return 'https:' + relativeUrl;

        if (relativeUrl.indexOf('/') === 0) {
            var m = baseUrl.match(/^(https?:\/\/[^\/]+)/);

            return m ? m[1] + relativeUrl : relativeUrl;
        }

        return origin ? baseUrl + relativeUrl : relativeUrl;
    }

    function parseMasterM3u8(m3u8Text, masterUrl) {
        var lines = String(m3u8Text || '').split(/\r?\n/);
        var qualities = {};
        var alts = {};
        var clean = stripQuery(masterUrl);
        var baseDir = clean.lastIndexOf('/') > clean.indexOf('://') + 2 ? clean.substring(0, clean.lastIndexOf('/') + 1) : (clean ? clean + '/' : '');
        var currentRes = null;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();

            if (line.indexOf('#EXT-X-STREAM-INF') === 0) {
                var resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);

                currentRes = resMatch ? parseInt(resMatch[2], 10) : 0;
            } else if (line && line.indexOf('#') !== 0) {
                if (currentRes !== null && currentRes > 0) {
                    var fullUrl = resolveUrl(baseDir, line);
                    var label = '240p';

                    if (currentRes >= 2000) label = '2160p';
                    else if (currentRes >= 1400) label = '1440p';
                    else if (currentRes >= 1000) label = '1080p';
                    else if (currentRes >= 700) label = '720p';
                    else if (currentRes >= 460) label = '480p';
                    else if (currentRes >= 340) label = '360p';

                    if (!qualities[label]) qualities[label] = fullUrl;
                    else if (!alts[label] && qualities[label] !== fullUrl) alts[label] = fullUrl;
                }

                currentRes = null;
            }
        }

        return {qualities: qualities, alts: alts};
    }

    var QUALITY_ORDER = ['2160p', '1440p', '1080p', '720p', '480p', '360p', '240p'];
    var QUALITY_PREF = {q1080: '1080p', q720: '720p', q480: '480p', q360: '360p'};

    function pickQualityLabel(qualities, prefKey) {
        var target = QUALITY_PREF[prefKey];

        if (!target) return '';
        if (qualities[target]) return target;

        // ближайшее не выше целевого, затем любое доступное
        var from = QUALITY_ORDER.indexOf(target);
        var i;

        for (i = from + 1; i < QUALITY_ORDER.length; i++) {
            if (qualities[QUALITY_ORDER[i]]) return QUALITY_ORDER[i];
        }

        for (i = 0; i < QUALITY_ORDER.length; i++) {
            if (qualities[QUALITY_ORDER[i]]) return QUALITY_ORDER[i];
        }

        return '';
    }

    // Внешние Android-плееры (Vimu и др.) кодируют ',' в '%2C', из-за чего bl.rutube.ru отдаёт 403 на masterUrl с guids=...,...
    function buildQualityData(masterUrl, parsed, prefKey, avoidCommaMaster) {
        var qualities = (parsed && parsed.qualities) || {};
        var alts = (parsed && parsed.alts) || {};
        var map = {};
        var url = masterUrl;
        var reserve = '';
        var label = '';
        var hasSubQualities = false;
        var hasMasterComma = String(masterUrl || '').indexOf(',') >= 0;
        var skipMaster = !!(avoidCommaMaster && hasMasterComma);
        var i;

        QUALITY_ORDER.forEach(function (q) {
            if (qualities[q]) hasSubQualities = true;
        });

        if (!skipMaster || !hasSubQualities) {
            map['Авто (HLS)'] = masterUrl;
        }

        QUALITY_ORDER.forEach(function (q) {
            if (qualities[q]) map[q] = qualities[q];
        });

        if (prefKey && prefKey !== 'auto') {
            label = pickQualityLabel(qualities, prefKey);
        } else if (skipMaster && hasSubQualities) {
            for (i = 0; i < QUALITY_ORDER.length; i++) {
                if (qualities[QUALITY_ORDER[i]]) {
                    label = QUALITY_ORDER[i];
                    break;
                }
            }
        }

        if (label && qualities[label]) {
            url = qualities[label];
            reserve = alts[label] || '';
        }

        if (!reserve || reserve === url) {
            reserve = '';

            if (url !== masterUrl && !skipMaster) {
                reserve = masterUrl;
            } else {
                for (i = 0; i < QUALITY_ORDER.length; i++) {
                    var cand = qualities[QUALITY_ORDER[i]];

                    if (cand && cand !== url) {
                        reserve = cand;
                        break;
                    }
                }
            }
        }

        return {url: url, qualityMap: map, reserveUrl: reserve};
    }

    // ---------- Карточки и данные ----------

    function getCardModules() {
        if (!card_modules && window.Lampa && Lampa.Maker) {
            card_modules = Lampa.Maker.module('Card').only('Card', 'Callback');
        }
        return card_modules;
    }

    function httpsUrl(url) {
        return String(url || '').replace(/^http:\/\//i, 'https://');
    }

    function toCard(v) {
        var author = v.author || {};
        var img = httpsUrl(v.thumbnail_url || v.picture_url || '');

        return {
            id: String(v.id),
            video_id: String(v.id),
            title: v.title || '',
            img: img,
            background: img,
            channel: author.name || '',
            channel_photo: httpsUrl(author.avatar_url || ''),
            author_id: author.id || '',
            views: v.hits || 0,
            date: parseTs(v.created_ts || v.publication_ts),
            duration: Math.floor(v.duration || 0),
            live: !!v.is_livestream,
            description: v.description || '',
            detailed: true,
            params: {module: getCardModules()}
        };
    }

    function stubCard(item) {
        var id = String(item.video_id || item.id);

        return {
            id: id,
            video_id: id,
            title: item.title || '',
            img: item.img || '',
            background: item.background_image || item.background || item.img || '',
            channel: '',
            views: 0,
            date: 0,
            duration: 0,
            live: false,
            description: '',
            detailed: false,
            params: {module: getCardModules()}
        };
    }

    function listToCards(data) {
        var out = [];

        ((data && data.results) || []).forEach(function (v) {
            if (!v || !v.id || v.is_hidden || v.is_deleted) return;
            out.push(toCard(v));
        });

        return out;
    }

    function dedupe(cards, seen) {
        var out = [];

        cards.forEach(function (c) {
            if (!c || seen[c.id]) return;
            seen[c.id] = 1;
            out.push(c);
        });

        return out;
    }

    function toLine(title, cards, more) {
        return cards.length ? {title: title, results: cards, total_pages: more ? 2 : 1, more: more} : null;
    }

    function loadLines(loaders, callback) {
        var lines = [];
        var left = loaders.length;

        if (!left) return callback([]);

        loaders.forEach(function (load, i) {
            load(function (line) {
                lines[i] = line;

                if (--left === 0) callback(lines.filter(Boolean));
            });
        });
    }

    function drainLineQueue(queue, onExhausted, resolve, reject) {
        if (!queue.length) return onExhausted();

        loadLines(queue.splice(0, SHELVES_PER_BATCH), function (loaded) {
            if (loaded && loaded.length) return resolve(loaded);

            drainLineQueue(queue, onExhausted, resolve, reject);
        });
    }

    function historyCards() {
        return Lampa.Favorite.get({type: 'history'}).filter(function (card) {
            return card.source === HISTORY_SOURCE;
        });
    }

    function addHistory(video) {
        var id = String(video.video_id || video.id);

        Lampa.Favorite.add('history', {id: id, source: HISTORY_SOURCE, title: video.title, img: video.img, background_image: video.background, video_id: id}, 100);

        historyCards().slice(HISTORY_SIZE).forEach(function (card) {
            Lampa.Favorite.remove('history', card);
        });
    }

    function historyLine(done) {
        var cards = historyCards().map(stubCard);

        if (!cards.length) return done(null);

        done(toLine(tr('rutube_history', 'История просмотра'), cards, {history: true}));
    }

    function searchLine(done) {
        done({
            title: tr('rutube_search_shelf', 'Поиск по Rutube'),
            results: [{
                id: 'rutube_search_trigger',
                is_search: true,
                title: tr('rutube_search_card', 'Поиск видео'),
                img: '',
                background: '',
                params: {module: getCardModules()}
            }],
            total_pages: 1
        });
    }

    function shelfLine(index) {
        var shelf = SHELVES[index];

        return function (done) {
            var title = tr(shelf.key, shelf.fb);

            apiGet(shelf.url(1), function (err, data) {
                if (err || !data) return done(null);

                done(toLine(title, listToCards(data), {shelf: index}));
            });
        };
    }

    function searchUrl(q, page) {
        return API + 'search/video/?query=' + encodeURIComponent(q) + '&page=' + page + '&per_page=' + PAGE_SIZE;
    }

    function authorUrl(id, page) {
        return API + 'video/person/' + encodeURIComponent(id) + '/?page=' + page;
    }

    // ---------- Потоки ----------

    function getVideoKey(video) {
        if (!video) return '';

        var vid = video.video_id || video.id;

        return vid ? String(vid) : '';
    }

    function isStreamDenied(data) {
        if (!data || typeof data !== 'object') return true;
        if (data.detail) return true;
        if (data.acl_access && data.acl_access.allowed === false) return true;
        if (data.has_video === false) return true;

        return false;
    }

    function extractStream(data) {
        if (isStreamDenied(data)) return null;

        var live = data.live_streams && data.live_streams.hls && data.live_streams.hls[0] && data.live_streams.hls[0].url;
        var vod = data.video_balancer && (data.video_balancer.m3u8 || data.video_balancer['default']);
        var url = live || vod || '';

        if (!url) return null;

        return {
            masterUrl: httpsUrl(url),
            live: !!live,
            // duration в play/options — миллисекунды! Карточки хранят секунды.
            durationSec: data.duration ? Math.floor(data.duration / 1000) : 0,
            title: data.title || ''
        };
    }

    // Кэш НЕ продлевается при попадании: ts ставится только при записи
    function resolveStream(video, callback) {
        var key = getVideoKey(video);

        if (!key) return callback(new Error('bad id'));

        var cached = resolve_cache[key];

        if (cached && (Date.now() - cached.ts < RESOLVE_TTL)) return callback(null, cached.stream);

        apiGet(API + 'play/options/' + encodeURIComponent(key) + '/?format=json&no_404=true', function (err, data) {
            if (err) {
                console.log('[Rutube] resolveStream error id=' + key + ' msg=' + (err.message || err));
                return callback(err);
            }

            var stream = extractStream(data);

            console.log('[Rutube] resolveStream ok=' + !!stream + ' live=' + !!(stream && stream.live) + ' id=' + key);

            if (!stream) return callback(new Error(tr('rutube_unavailable', 'Видео недоступно')));

            resolve_cache[key] = {ts: Date.now(), stream: stream};

            callback(null, stream);
        });
    }

    function fetchMasterQualities(stream, callback) {
        if (stream.live) return callback({qualities: {}, alts: {}});
        if (stream.parsed) return callback(stream.parsed);

        textGet(stream.masterUrl, function (err, text) {
            // при сетевой ошибке/CORS не ломаем запуск — отдадим masterUrl
            if (err || !text) return callback({qualities: {}, alts: {}});

            var parsed = {qualities: {}, alts: {}};

            try {
                parsed = parseMasterM3u8(text, stream.masterUrl);
            } catch (e) {}

            stream.parsed = parsed;
            callback(parsed);
        });
    }

    // ---------- Прогресс ----------

    function getProgressMap() {
        var map = Lampa.Storage.get(PROGRESS_KEY, {});

        return (map && typeof map === 'object' && !Array.isArray(map)) ? map : {};
    }

    function getSavedProgress(video) {
        var key = getVideoKey(video);

        if (!key) return null;

        return getProgressMap()[key] || null;
    }

    function saveProgress(key, timeSec, durationSec) {
        if (!key || !durationSec || durationSec <= 0 || !isFinite(durationSec) || !isFinite(timeSec) || timeSec < 0) return;

        var map = getProgressMap();

        map[key] = {
            time: Math.floor(timeSec),
            duration: Math.floor(durationSec),
            percent: Math.min(100, Math.max(0, Math.round((timeSec / durationSec) * 100))),
            ts: Date.now()
        };

        var keys = Object.keys(map);

        if (keys.length > 200) {
            keys.sort(function (a, b) {
                return (map[b].ts || 0) - (map[a].ts || 0);
            });

            var trimmed = {};

            for (var i = 0; i < 200; i++) {
                trimmed[keys[i]] = map[keys[i]];
            }

            map = trimmed;
        }

        Lampa.Storage.set(PROGRESS_KEY, map);
    }

    function getResumeTime(video) {
        if (!video || video.live) return 0;

        var prog = getSavedProgress(video);

        if (!prog || !prog.time || !prog.duration) return 0;

        var ratio = prog.time / prog.duration;

        if (ratio >= 0.03 && ratio < 0.95) return prog.time;

        return 0;
    }

    function flushProgress() {
        var ctx = progress_ctx;

        if (!ctx || !ctx.el) return;

        try {
            var cur = ctx.el.currentTime;
            var dur = (ctx.el.duration && isFinite(ctx.el.duration)) ? ctx.el.duration : (ctx.video.duration || 0);

            if (cur > 0 && dur > 0) saveProgress(ctx.key, cur, dur);
        } catch (e) {}
    }

    function stopProgressMonitor() {
        if (progress_timer) {
            clearInterval(progress_timer);
            progress_timer = null;
        }
    }

    function onPlayerDestroy() {
        flushProgress();
        stopProgressMonitor();
        progress_ctx = null;
        play_lock_until = 0;
    }

    function bindPlayerLifecycle() {
        if (player_listener_bound) return;

        if (window.Lampa && Lampa.Player && Lampa.Player.listener && Lampa.Player.listener.follow) {
            Lampa.Player.listener.follow('destroy', onPlayerDestroy);
            player_listener_bound = true;
        }
    }

    function isPrerollVideo(el, video) {
        if (!el) return true;
        if (video && video.duration > 30 && el.duration && isFinite(el.duration) && el.duration < 25) return true;
        return false;
    }

    function startProgressMonitor(video, resumeSec) {
        stopProgressMonitor();
        bindPlayerLifecycle();

        if (!video || video.live) return;

        var key = getVideoKey(video);

        if (!key) return;

        progress_ctx = {key: key, video: video, el: null};

        var seekDone = !(resumeSec > 0);
        var boundEl = null;

        function trySeek(el) {
            if (seekDone || !el) return;

            function doSeek() {
                if (seekDone) return;
                seekDone = true;
                try {
                    if (el.currentTime < 2) el.currentTime = resumeSec;
                } catch (e) {}
            }

            if (el.readyState >= 1) {
                doSeek();
            } else if (boundEl !== el) {
                boundEl = el;

                var onMeta = function () {
                    el.removeEventListener('loadedmetadata', onMeta);
                    doSeek();
                };

                el.addEventListener('loadedmetadata', onMeta);
            }
        }

        var startedAt = Date.now();
        var everPlayed = false;

        progress_timer = setInterval(function () {
            var videoEl = document.querySelector('video');
            var opened = window.Lampa && Lampa.Player && typeof Lampa.Player.opened === 'function' ? Lampa.Player.opened() : false;

            if (!opened && !videoEl) {
                if (everPlayed || Date.now() - startedAt > 20000) stopProgressMonitor();
                return;
            }

            if (videoEl && videoEl.readyState >= 1 && !isPrerollVideo(videoEl, video)) {
                if (progress_ctx) progress_ctx.el = videoEl;
                trySeek(videoEl);

                var cur = videoEl.currentTime;
                var dur = (videoEl.duration && isFinite(videoEl.duration)) ? videoEl.duration : (video.duration || 0);

                if (cur > 0 && dur > 0) {
                    everPlayed = true;
                    saveProgress(key, cur, dur);
                }
            }
        }, 2500);
    }

    // ---------- Плеер ----------

    function getLampaPlayer() {
        if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') return String(Lampa.Storage.field('player') || 'inner');

        return String(Lampa.Storage.get('player', 'inner') || 'inner');
    }

    function isTvOrAndroid() {
        if (window.Lampa) {
            if (Lampa.Platform) {
                if (typeof Lampa.Platform.tv === 'function' && Lampa.Platform.tv()) return true;
                if (typeof Lampa.Platform.get === 'function') {
                    var pf = String(Lampa.Platform.get() || '');
                    if (pf === 'android' || pf === 'tizen' || pf === 'webos' || pf === 'orsay' || pf === 'netcast' || pf === 'apple_tv') return true;
                }
                if (typeof Lampa.Platform.is === 'function' && (
                    Lampa.Platform.is('android') || Lampa.Platform.is('tizen') ||
                    Lampa.Platform.is('webos') || Lampa.Platform.is('orsay') ||
                    Lampa.Platform.is('netcast') || Lampa.Platform.is('apple_tv')
                )) return true;
                if (typeof Lampa.Platform.screen === 'function' && Lampa.Platform.screen('tv')) return true;
            }
            if (Lampa.Storage && typeof Lampa.Storage.get === 'function') {
                var sp = String(Lampa.Storage.get('platform', '') || '');
                if (sp === 'android' || sp === 'tizen' || sp === 'webos' || sp === 'orsay' || sp === 'netcast' || sp === 'apple_tv') return true;
            }
        }
        if (window.Android || window.AndroidJS) return true;
        return /Android|SmartTV|SMART-TV|Tizen|Web0S/i.test(navigator.userAgent || '');
    }

    function getQualityPref() {
        return String(Lampa.Storage.get('rutube_quality', 'auto') || 'auto');
    }

    var tube_duration_hint = 0;

    function canRegisterTube() {
        return !!(window.Lampa && Lampa.PlayerVideo && typeof Lampa.PlayerVideo.registerTube === 'function' && typeof Lampa.Subscribe === 'function');
    }

    function canNativeHls() {
        try {
            var v = document.createElement('video');
            return !!(v && typeof v.canPlayType === 'function' && v.canPlayType('application/vnd.apple.mpegurl'));
        } catch (e) {
            return false;
        }
    }

    function registerRutubeNativeHls() {
        if (!canRegisterTube() || window.rutube_native_hls_registered) return;
        window.rutube_native_hls_registered = true;

        Lampa.PlayerVideo.registerTube({
            name: 'RutubeNativeHLS',
            verify: function (src) {
                return typeof src === 'string' && src.indexOf('#rutube_hls') >= 0;
            },
            create: function (call_video) {
                var object = $('<video class="player-video__video" playsinline autoplay style="width:100%;height:100%;object-fit:contain;background:#000;"></video>');
                var video = object[0];
                var nativeLoad = video.load;

                video.load = function () {
                    var raw = video.getAttribute('src') || video.src || '';
                    if (raw && raw.indexOf('#rutube_hls') >= 0) {
                        video.src = raw.replace(/#rutube_hls$/, '');
                    }
                    try {
                        video.muted = false;
                        video.volume = 1;
                    } catch (e) {}
                    if (typeof nativeLoad === 'function') {
                        return nativeLoad.call(video);
                    }
                };

                video.resize = function () {};
                video.size = function (type) {
                    video.style.objectFit = type === 'cover' ? 'cover' : 'contain';
                };
                video.speed = function (rate) {
                    try {
                        video.playbackRate = Number(rate) || 1;
                    } catch (e) {}
                };
                video.destroy = function () {
                    try {
                        video.pause();
                        video.removeAttribute('src');
                        if (typeof nativeLoad === 'function') nativeLoad.call(video);
                    } catch (e) {}
                    object.remove();
                };

                call_video(video);
                return object;
            }
        });
    }

    function extractEmbedId(url) {
        if (!url) return '';
        var str = String(url);
        var idx = str.indexOf('rutube.ru/play/embed/');
        if (idx < 0) return '';
        return str.slice(idx + 'rutube.ru/play/embed/'.length).split(/[?&#/]/)[0];
    }

    function registerRutubeTube() {
        if (!canRegisterTube() || window.rutube_tube_registered) return;
        window.rutube_tube_registered = true;

        Lampa.PlayerVideo.registerTube({
            name: 'Rutube',
            verify: function (src) {
                return typeof src === 'string' && src.indexOf('rutube.ru/play/embed/') >= 0;
            },
            create: function (call_video) {
                var stream_url = '';
                var object = $('<div class="player-video__youtube"><div class="player-video__youtube-player" style="width:100%;height:100%;"></div></div>');
                var video = object[0];
                var listener = Lampa.Subscribe();
                var frame = null;
                var frameWindow = null;
                var readyFired = false;
                var fallbackTimer = null;
                var unmuteTimer1 = null;
                var unmuteTimer2 = null;
                var timeTimer = null;
                var seekPending = 0;
                var videoId = '';

                video._currentTime = 0;
                video._duration = tube_duration_hint || 0;
                tube_duration_hint = 0;
                video._paused = false;

                function postCmd(type, data) {
                    if (!frameWindow) return;
                    try {
                        frameWindow.postMessage(JSON.stringify({type: type, data: data || {}}), PLAYER_ORIGIN);
                    } catch (e) {}
                }

                function unmuteAndPlay() {
                    postCmd('player:unMute', {});
                    postCmd('player:setVolume', {volume: 100});
                    postCmd('player:play', {});
                }

                function markReady() {
                    if (readyFired) return;
                    readyFired = true;
                    clearTimeout(fallbackTimer);
                    listener.send('canplay');
                    listener.send('loadeddata');
                    listener.send('playing');
                    unmuteAndPlay();
                    unmuteTimer1 = setTimeout(function () {
                        postCmd('player:unMute', {});
                        postCmd('player:setVolume', {volume: 100});
                    }, 600);
                    unmuteTimer2 = setTimeout(function () {
                        postCmd('player:unMute', {});
                        postCmd('player:setVolume', {volume: 100});
                    }, 1500);
                    if (seekPending > 0) {
                        var s = seekPending;
                        seekPending = 0;
                        setTimeout(function () {
                            postCmd('player:setCurrentTime', {time: s});
                        }, 400);
                    }
                    clearInterval(timeTimer);
                    timeTimer = setInterval(function () {
                        if (!video._paused && video._duration > 0) {
                            listener.send('timeupdate', {duration: video._duration, current: video._currentTime});
                        }
                    }, 500);
                }

                function onMessage(event) {
                    if (!event || !event.data) return;
                    var msg = event.data;
                    if (typeof msg === 'string') {
                        try {
                            msg = JSON.parse(msg);
                        } catch (e) {
                            return;
                        }
                    }
                    if (!msg || typeof msg.type !== 'string') return;

                    if (msg.type === 'player:ready') {
                        markReady();
                        return;
                    }
                    if (msg.type === 'player:durationChange') {
                        var d = msg.data && Number(msg.data.duration);
                        if (d > 0 && isFinite(d)) video._duration = d;
                        return;
                    }
                    if (msg.type === 'player:currentTime') {
                        var t = msg.data && Number(msg.data.time);
                        if (t >= 0 && isFinite(t)) {
                            video._currentTime = t;
                            if (!readyFired && t > 0) markReady();
                            if (videoId && t > 0 && video._duration > 0) {
                                saveProgress(videoId, t, video._duration);
                            }
                        }
                        return;
                    }
                    if (msg.type === 'player:changeState') {
                        var st = msg.data && msg.data.state;
                        if (st === 'playing') {
                            video._paused = false;
                            if (!readyFired) markReady();
                            else listener.send('playing');
                        } else if (st === 'paused') {
                            video._paused = true;
                        } else if (st === 'stopped' || st === 'ended') {
                            video._paused = true;
                            listener.send('ended');
                        } else if (st === 'buffering' || st === 'loading') {
                            listener.send('waiting');
                        }
                    }
                }

                Object.defineProperty(video, 'src', {
                    set: function (url) {
                        if (url) stream_url = String(url);
                    },
                    get: function () {
                        return stream_url;
                    }
                });

                Object.defineProperty(video, 'currentTime', {
                    set: function (t) {
                        var sec = Number(t) || 0;
                        video._currentTime = sec;
                        if (readyFired) postCmd('player:setCurrentTime', {time: sec});
                        else seekPending = sec;
                    },
                    get: function () {
                        return video._currentTime || 0;
                    }
                });

                Object.defineProperty(video, 'duration', {
                    set: function () {},
                    get: function () {
                        return video._duration || 0;
                    }
                });

                Object.defineProperty(video, 'paused', {
                    set: function () {},
                    get: function () {
                        return !!video._paused;
                    }
                });

                Object.defineProperty(video, 'audioTracks', {
                    set: function () {},
                    get: function () { return []; }
                });

                Object.defineProperty(video, 'textTracks', {
                    set: function () {},
                    get: function () { return []; }
                });

                Object.defineProperty(video, 'videoWidth', {
                    set: function () {},
                    get: function () { return 1920; }
                });

                Object.defineProperty(video, 'videoHeight', {
                    set: function () {},
                    get: function () { return 1080; }
                });

                Object.defineProperty(video, 'volume', {
                    set: function (num) {
                        var v = Math.max(0, Math.min(100, Math.round((Number(num) || 1) * 100)));
                        postCmd('player:setVolume', {volume: v});
                    },
                    get: function () { return 1; }
                });

                Object.defineProperty(video, 'muted', {
                    set: function (m) {
                        postCmd(m ? 'player:mute' : 'player:unMute', {});
                    },
                    get: function () { return false; }
                });

                video.canPlayType = function () { return true; };
                video.resize = function () {};
                video.addEventListener = listener.follow.bind(listener);

                video.load = function () {
                    if (!stream_url || frame) return;
                    videoId = extractEmbedId(stream_url);
                    if (!videoId) return;

                    frame = document.createElement('iframe');
                    frame.className = 'player-video__youtube-bridge-frame';
                    frame.src = EMBED_URL + encodeURIComponent(videoId) + '?autoplay=1';
                    frame.setAttribute('frameborder', '0');
                    frame.setAttribute('allowfullscreen', 'true');
                    frame.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
                    frame.style.width = '100%';
                    frame.style.height = '100%';
                    frame.style.border = '0';
                    frame.style.display = 'block';

                    frame.onload = function () {
                        try {
                            frameWindow = frame.contentWindow;
                        } catch (e) {}
                        fallbackTimer = setTimeout(markReady, 3500);
                    };

                    object.find('.player-video__youtube-player').empty().append(frame);
                };

                video.play = function () {
                    video._paused = false;
                    unmuteAndPlay();
                    listener.send('playing');
                };

                video.pause = function () {
                    video._paused = true;
                    postCmd('player:pause', {});
                };

                video.size = function () {};
                video.speed = function () {};

                video.destroy = function () {
                    clearTimeout(fallbackTimer);
                    clearTimeout(unmuteTimer1);
                    clearTimeout(unmuteTimer2);
                    clearInterval(timeTimer);
                    if (videoId && video._currentTime > 0 && video._duration > 0) {
                        saveProgress(videoId, video._currentTime, video._duration);
                    }
                    postCmd('player:pause', {});
                    postCmd('player:mute', {});
                    if (frame) {
                        try {
                            frame.src = 'about:blank';
                            if (frame.parentNode) frame.parentNode.removeChild(frame);
                        } catch (e) {}
                    }
                    frame = null;
                    frameWindow = null;
                    window.removeEventListener('message', onMessage);
                    object.remove();
                    listener.destroy();
                };

                window.addEventListener('message', onMessage);
                call_video(video);
                return object;
            }
        });
    }

    function openWatch(video) {
        Lampa.Activity.push({component: 'rutube_video', title: video.title, vid: getVideoKey(video), video: video.detailed ? video : null, url: '', page: 1});
    }

    function playDirect(video) {
        if (Date.now() < play_lock_until) return;
        play_lock_until = Date.now() + 5000;

        var pref = getQualityPref();
        var fastPlayer = getLampaPlayer();
        var fastKey = getVideoKey(video);
        var tvAndroid = isTvOrAndroid();
        var wantNativeHls = fastPlayer === 'inner' && tvAndroid && canRegisterTube() && canNativeHls();

        if (fastPlayer === 'inner' && canRegisterTube() && !wantNativeHls && fastKey && window.Lampa && Lampa.Player) {
            registerRutubeTube();
            addHistory(video);

            var resumeSecT = getResumeTime(video);
            var durT = video.duration || 0;
            var playUrlT = EMBED_URL + encodeURIComponent(fastKey);
            var playDataT = {
                url: playUrlT,
                title: video.title || MENU_TITLE
            };

            tube_duration_hint = durT;

            if (resumeSecT > 0) {
                playDataT.timeline = {
                    time: resumeSecT,
                    duration: durT,
                    percent: Math.round((resumeSecT / (durT || 1)) * 100)
                };
            }

            console.log('[Rutube] playDirect lampa_player=inner mode=tube_embed fast=true dur=' + durT + ' id=' + fastKey);

            Lampa.Player.play(playDataT);
            stopProgressMonitor();
            return;
        }

        function tagNativeHls(u) {
            if (!u || u.indexOf('#rutube_hls') >= 0) return u;
            return u + '#rutube_hls';
        }

        function fail() {
            play_lock_until = 0;

            if (tvAndroid) {
                notifyText(tr('rutube_direct_unavailable_tv', 'Rutube: прямой поток недоступен для этого видео'));
                return;
            }

            notifyText(tr('rutube_direct_unavailable', 'Rutube: прямой поток недоступен, открыт плеер Rutube'));
            openWatch(video);
        }

        resolveStream(video, function (err, stream) {
            if (err || !stream || !window.Lampa || !Lampa.Player) return fail();

            fetchMasterQualities(stream, function (parsed) {
                var lampaPlayer = getLampaPlayer();
                var useNativeHls = lampaPlayer === 'inner' && isTvOrAndroid() && canRegisterTube() && canNativeHls();
                var useTubeEmbed = lampaPlayer === 'inner' && !useNativeHls && canRegisterTube();
                var qData = stream.live ? {url: stream.masterUrl, qualityMap: {}, reserveUrl: ''} : buildQualityData(stream.masterUrl, parsed, pref, lampaPlayer !== 'inner' || useNativeHls);
                var target = video;

                if (!qData.url) return fail();

                if (useNativeHls) {
                    registerRutubeNativeHls();
                } else if (useTubeEmbed) {
                    registerRutubeTube();
                }

                // длительность из карточки (секунды); play/options (мс) не перезаписывает её
                if (!target.duration && stream.durationSec) {
                    target = {id: video.id, video_id: video.video_id, title: video.title, img: video.img, background: video.background, author_id: video.author_id, live: stream.live, duration: stream.durationSec};
                }

                addHistory(video);

                var resumeSec = getResumeTime(target);
                var dur = target.duration || 0;
                var playUrl = useTubeEmbed ? (EMBED_URL + encodeURIComponent(getVideoKey(target))) : (useNativeHls ? tagNativeHls(qData.url) : qData.url);
                var playData = {
                    url: playUrl,
                    title: video.title || stream.title
                };

                if (!useTubeEmbed) {
                    if (Object.keys(qData.qualityMap).length > 1) {
                        if (useNativeHls) {
                            var taggedMap = {};
                            for (var qk in qData.qualityMap) {
                                if (Object.prototype.hasOwnProperty.call(qData.qualityMap, qk)) {
                                    taggedMap[qk] = tagNativeHls(qData.qualityMap[qk]);
                                }
                            }
                            playData.quality = taggedMap;
                        } else {
                            playData.quality = qData.qualityMap;
                        }
                    }
                    if (qData.reserveUrl) playData.url_reserve = useNativeHls ? tagNativeHls(qData.reserveUrl) : qData.reserveUrl;
                }

                if (resumeSec > 0) {
                    playData.timeline = {
                        time: resumeSec,
                        duration: dur,
                        percent: Math.round((resumeSec / (dur || 1)) * 100)
                    };
                }

                console.log('[Rutube] playDirect lampa_player=' + lampaPlayer + ' mode=' + (useNativeHls ? 'native_hls' : (useTubeEmbed ? 'tube_embed' : 'hls')) + ' quality=' + pref + ' live=' + !!stream.live + ' qualities=' + Object.keys(qData.qualityMap).length + ' hasComma=' + (playUrl.indexOf(',') >= 0) + ' reserve=' + (qData.reserveUrl ? 'yes' : 'none'));

                Lampa.Player.play(playData);

                if (lampaPlayer === 'inner' && !useTubeEmbed) startProgressMonitor(target, resumeSec);
                else stopProgressMonitor();
            });
        });
    }

    function openVideo(video) {
        var tv = isTvOrAndroid();
        var mode = tv ? 'direct' : Lampa.Storage.get('rutube_player_mode', 'direct');

        console.log('[Rutube] openVideo mode=' + (tv ? 'direct(tv)' : mode) + ' lampa_player=' + getLampaPlayer() + ' quality=' + getQualityPref() + ' id=' + getVideoKey(video));

        if (mode === 'direct') playDirect(video);
        else openWatch(video);
    }

    function openMore(more, title) {
        if (more.history) return Lampa.Router.call('favorite', {type: 'history', title: Lampa.Lang.translate('title_history')});

        Lampa.Activity.push({component: 'rutube_section', title: title, shelf: more.shelf, author_id: more.author_id, url: '', page: 1});
    }

    function openCatalog() {
        Lampa.Activity.push({component: 'rutube_main', title: tr('rutube_title', MENU_TITLE), url: '', page: 1});
    }

    function startSearch() {
        if (!window.Lampa || !Lampa.Input) return;

        Lampa.Input.edit({
            title: tr('rutube_search_input', 'Поиск в Rutube'),
            value: '',
            free: true,
            nosave: true,
            keyboard: 'lampa'
        }, function (value) {
            if (value && value.trim()) {
                Lampa.Activity.push({
                    component: 'rutube_search',
                    title: tr('rutube_search_prefix', 'Поиск: ') + value.trim(),
                    query: value.trim(),
                    url: '',
                    page: 1
                });
            }
        });
    }

    // ---------- Карточки / списки ----------

    var CardView = {
        onCreate: function () {
            var data = this.data;
            var view = this.html.querySelector('.card__view');
            var meta = this.html.querySelector('.card__age');

            this.html.classList.add('card--rutube');

            if (view) {
                if (data.live || data.duration) {
                    var badge = document.createElement('div');

                    badge.className = 'card__rutube-badge' + (data.live ? ' card__rutube-badge--live' : '');
                    badge.textContent = data.live ? tr('rutube_live', 'Эфир') : formatDuration(data.duration);
                    view.appendChild(badge);
                }

                if (!data.live) {
                    var prog = getSavedProgress(data);

                    if (prog && prog.percent >= 3) {
                        var progBadge = document.createElement('div');
                        var done = prog.percent >= 95;

                        progBadge.className = 'card__rutube-progress' + (done ? ' card__rutube-progress--done' : '');
                        progBadge.textContent = done ? tr('rutube_watched_done', '✓ Просмотрено') : (tr('rutube_watched', 'Просмотрено') + ' ' + prog.percent + '%');
                        view.appendChild(progBadge);
                    }
                }
            }

            if (!meta) {
                meta = document.createElement('div');
                meta.className = 'card__age';
                this.html.appendChild(meta);
            }

            meta.textContent = [data.channel, data.views ? countText(data.views, 'просмотр', 'просмотра', 'просмотров') : ''].filter(Boolean).join(' · ');
        }
    };

    function setupCard(card, video) {
        if (video.is_search) {
            card.use({
                onCreate: function () {
                    this.html.classList.add('card--rutube', 'card--rutube-search');

                    var view = this.html.querySelector('.card__view');

                    if (view) view.innerHTML = ICON_SEARCH;
                },
                onEnter: function () {
                    startSearch();
                }
            });
            return;
        }

        card.use(CardView);
        card.use({
            onEnter: function () {
                openVideo(video);
            },
            onFocus: function () {
                if (video.background) Lampa.Background.change(video.background);
            }
        });
    }

    function setupLine(line) {
        line.use({
            onMore: function (data) {
                openMore(data.more, data.title);
            },
            onInstance: setupCard
        });
    }

    function CatalogPage(object) {
        var queue = [];
        var comp = Lampa.Maker.make('Main', object);

        comp.use({
            onCreate: function () {
                var self = this;

                queue = SHELVES.map(function (s, i) {
                    return shelfLine(i);
                });

                loadLines([searchLine, historyLine].concat(queue.splice(0, 3)), function (lines) {
                    if (lines.length) self.build(lines);
                    else self.empty();
                });
            },
            onNext: function (resolve, reject) {
                drainLineQueue(queue, reject, resolve, reject);
            },
            onInstance: setupLine
        });

        return comp;
    }

    // Общий постраничный загрузчик (SectionPage / SearchPage)
    function PagedCategory(object, buildUrl) {
        var nextPage = 1;
        var hasNext = true;
        var currentPage = object.page || 1;
        var loading = false;
        var seenIds = {};
        var seenCursors = {};
        var pendingNext = null;

        object.params = {items: {cols: 4}};

        var comp = Lampa.Maker.make('Category', object, function (mod) {
            return mod.toggle(mod.MASK.base, 'Pagination');
        });

        function flushLoaded(instance) {
            if (!instance) return;
            instance.limit_view = 20;
            if (typeof instance.emit === 'function') {
                while (instance.loaded && instance.loaded.length) {
                    instance.emit('pushLoaded');
                }
            }
        }

        function syncPageHeader(instance, totalOverride) {
            if (!instance) return;
            var loadedPage = Math.max(1, currentPage - 1);
            if (!hasNext || totalOverride) {
                instance.total_pages = totalOverride || loadedPage;
                if (instance.object) instance.object.page = instance.total_pages;
            } else {
                instance.total_pages = 1000;
                if (instance.object) instance.object.page = loadedPage;
            }
            if (typeof instance.emit === 'function') {
                instance.emit('scroll');
            }
        }

        function loadChunk(done, fail, emptyHops) {
            emptyHops = emptyHops || 0;

            var url = buildUrl(nextPage);

            if (!url) return fail();

            loading = true;

            apiGet(url, function (err, data) {
                if (err || !data) {
                    if (currentPage === 1 && err) notify(err);
                    hasNext = false;
                    loading = false;
                    return fail();
                }

                var cursor = data.next ? String(data.next) : '';

                hasNext = !!data.has_next || !!cursor;

                if (hasNext && cursor && seenCursors[cursor]) hasNext = false;
                if (cursor) seenCursors[cursor] = 1;

                nextPage++;

                var chunk = dedupe(listToCards(data), seenIds);

                if (!chunk.length) {
                    if (hasNext && emptyHops < MAX_EMPTY_HOPS) return loadChunk(done, fail, emptyHops + 1);

                    hasNext = false;
                    loading = false;
                    return fail();
                }

                loading = false;

                var pageNum = currentPage++;

                done({
                    results: chunk,
                    page: pageNum,
                    total_pages: hasNext ? 1000 : pageNum
                });
            });
        }

        function runPendingNext() {
            if (!pendingNext || loading) return;
            var p = pendingNext;
            pendingNext = null;

            if (!hasNext) {
                syncPageHeader(p.instance);
                if (p.reject) p.reject();
                return;
            }

            loadChunk(function (data) {
                p.resolve(data);
                flushLoaded(p.instance);
                syncPageHeader(p.instance);
                runPendingNext();
            }, function () {
                hasNext = false;
                loading = false;
                syncPageHeader(p.instance);
                if (p.reject) p.reject();
            });
        }

        comp.use({
            onCreate: function () {
                var self = this;
                self.limit_view = 20;

                loadChunk(function (data) {
                    self.limit_view = 20;
                    self.build(data);
                    flushLoaded(self);
                    syncPageHeader(self);
                }, function () {
                    self.empty();
                });
            },
            onNext: function (resolve, reject) {
                var self = this;
                self.limit_view = 20;

                if (self.loaded && self.loaded.length) {
                    flushLoaded(self);
                }

                if (!hasNext) {
                    syncPageHeader(self);
                    if (reject) reject();
                    return;
                }

                if (loading) {
                    if (self.object) self.object.page = Math.max(1, currentPage - 1);
                    pendingNext = {resolve: resolve, reject: reject, instance: self};
                    return;
                }

                loadChunk(function (data) {
                    resolve(data);
                    flushLoaded(self);
                    syncPageHeader(self);
                    runPendingNext();
                }, function () {
                    hasNext = false;
                    loading = false;
                    syncPageHeader(self);
                    if (reject) reject();
                });
            },
            onInstance: setupCard
        });

        return comp;
    }

    function SectionPage(object) {
        return PagedCategory(object, function (page) {
            if (object.author_id) return authorUrl(object.author_id, page);

            var shelf = SHELVES[object.shelf];

            return shelf ? shelf.url(page) : '';
        });
    }

    function SearchPage(object) {
        var queryStr = (object.query || '').trim();

        return PagedCategory(object, function (page) {
            return queryStr ? searchUrl(queryStr, page) : '';
        });
    }

    // ---------- WatchPage ----------

    function avatar(className, url) {
        return '<div class="' + className + '"' + (url ? ' style="background-image: url(\'' + esc(url) + '\')"' : '') + '></div>';
    }

    function WatchPage(object) {
        this.object = object;
        this.video = object.video;
        this.scroll = new Lampa.Scroll({mask: true, over: true, step: 250});
        this.html = document.createElement('div');
    }

    WatchPage.prototype.create = function () {
        this.scroll.minus();
        this.html.appendChild(this.scroll.render(true));

        if (this.video && this.video.id && this.video.detailed) this.build();
        else this.restore();
    };

    WatchPage.prototype.restore = function () {
        var self = this;
        var object = this.object;
        var id = object.vid || getVideoKey(this.video);

        this.activity.loader(true);

        apiGet(API + 'video/' + encodeURIComponent(id) + '/?format=json', function (err, data) {
            if (self.destroyed) return;

            if (err || !data || data.detail || !data.id) {
                self.activity.loader(false);
                self.scroll.append($('<div class="rutube-watch"><div class="rutube-watch__note">' + esc(tr('rutube_unavailable', 'Видео недоступно')) + '</div></div>'));
                self.activity.toggle();
                return;
            }

            var card = toCard(data);

            // проверка доступности потока через play/options
            resolveStream(card, function (sErr) {
                if (self.destroyed) return;

                card.no_stream = !!sErr;
                self.video = object.video = card;
                self.activity.loader(false);
                self.build();
                self.activity.toggle();
            });
        });
    };

    WatchPage.prototype.build = function () {
        var self = this;
        var video = this.video;
        var stats = [video.views ? countText(video.views, 'просмотр', 'просмотра', 'просмотров') : '', formatDate(video.date)].filter(Boolean).join(' · ');
        var desc = video.description || '';
        var long = desc.length > 200 || desc.split('\n').length > 3;
        var hasDirect = !video.no_stream && !isTvOrAndroid();

        this.body = document.createElement('div');
        this.body.className = 'rutube-watch';
        this.body.innerHTML = [
            '<div class="rutube-watch__inner">',
            '<div class="rutube-watch__buttons">',
            '<div class="simple-button simple-button--inline selector rutube-watch__back"><svg><use xlink:href="#sprite-backward"></use></svg><span>' + esc(tr('rutube_back', 'Назад')) + '</span></div>',
            hasDirect ? '<div class="simple-button simple-button--inline selector rutube-watch__native">' + ICON_PLAY + '<span>' + esc(tr('rutube_play_native', 'Воспроизвести (Плеер)')) + '</span></div>' : '',
            '</div>',
            '<div class="rutube-watch__player selector"></div>',
            '<div class="rutube-watch__body">',
            '<div class="rutube-watch__title">' + esc(video.title) + '</div>',
            '<div class="rutube-watch__stats">' + esc(stats) + '</div>',
            video.channel ? '<div class="rutube-watch__channel' + (video.author_id ? ' selector' : '') + '">' + avatar('rutube-watch__avatar', video.channel_photo) +
                '<div><div class="rutube-watch__channel-name">' + esc(video.channel) + '</div>' +
                (video.author_id ? '<div class="rutube-watch__channel-sub">' + esc(tr('rutube_open_channel', 'Все видео канала')) + '</div>' : '') + '</div></div>' : '',
            desc ? '<div class="rutube-watch__desc' + (long ? ' selector' : ' expanded') + '"><div class="rutube-watch__desc-text">' + esc(desc) + '</div>' +
                (long ? '<div class="rutube-watch__desc-toggle">' + esc(tr('rutube_show_more_desc', 'Показать полностью')) + '</div>' : '') + '</div>' : '',
            '</div>',
            '</div>'
        ].join('');

        this.frame = document.createElement('iframe');
        this.frame.src = EMBED_URL + encodeURIComponent(getVideoKey(video));
        this.frame.setAttribute('allow', 'autoplay; fullscreen; encrypted-media');
        this.frame.setAttribute('allowfullscreen', 'true');
        this.body.querySelector('.rutube-watch__player').appendChild(this.frame);

        $(this.body.querySelector('.rutube-watch__back')).on('hover:enter', function () {
            Lampa.Activity.backward();
        });

        // единственный обработчик на .rutube-watch__native
        if (hasDirect) {
            $(this.body.querySelector('.rutube-watch__native')).on('hover:enter', function () {
                self.killFrame();
                playDirect(video);
            });
        }

        var channel = this.body.querySelector('.rutube-watch__channel.selector');

        if (channel) {
            $(channel).on('hover:enter', function () {
                self.killFrame();
                Lampa.Activity.push({component: 'rutube_section', title: video.channel, author_id: video.author_id, url: '', page: 1});
            });
        }

        this.last = this.body.querySelector('.rutube-watch__native') || this.body.querySelector('.rutube-watch__back');

        $(this.body.querySelector('.rutube-watch__desc.selector')).on('hover:enter', function () {
            $(this).toggleClass('expanded');
            $(this).find('.rutube-watch__desc-toggle').text($(this).hasClass('expanded') ? tr('rutube_collapse_desc', 'Свернуть') : tr('rutube_show_more_desc', 'Показать полностью'));
        });

        this.bindFocus(this.body.querySelectorAll('.selector'));
        this.scroll.append(this.body);

        if (video.background) Lampa.Background.change(video.background);

        addHistory(video);
    };

    WatchPage.prototype.command = function (method) {
        if (this.frame && this.frame.contentWindow) {
            try {
                this.frame.contentWindow.postMessage(JSON.stringify({type: 'player:' + method, data: {}}), PLAYER_ORIGIN);
            } catch (e) {}
        }
    };

    // жёсткая остановка iframe ДО запуска плеера Lampa (защита от двойного звука)
    WatchPage.prototype.killFrame = function () {
        if (!this.frame) return;

        try { this.command('pause'); } catch (e) {}
        try { this.command('mute'); } catch (e) {}
        try { this.frame.src = 'about:blank'; } catch (e) {}
    };

    WatchPage.prototype.bindFocus = function (nodes) {
        var self = this;

        $(nodes).on('hover:focus', function () {
            self.last = this;

            if (this.classList.contains('rutube-watch__player') || this.classList.contains('rutube-watch__back') || this.classList.contains('rutube-watch__native')) self.scroll.reset();
            else self.scroll.update($(this), true);
        });
    };

    WatchPage.prototype.start = function () {
        var self = this;
        var render = this.scroll.render(true);

        Lampa.Controller.add('content', {
            link: this,
            invisible: true,
            toggle: function () {
                Lampa.Controller.collectionSet(render);

                if (Lampa.Platform && typeof Lampa.Platform.screen === 'function' && Lampa.Platform.screen('tv')) Lampa.Controller.collectionFocus(self.last || false, render);
            },
            left: function () {
                if (Navigator.canmove('left')) Navigator.move('left');
                else Lampa.Controller.toggle('menu');
            },
            right: function () {
                Navigator.move('right');
            },
            up: function () {
                if (Navigator.canmove('up')) Navigator.move('up');
                else Lampa.Controller.toggle('head');
            },
            down: function () {
                Navigator.move('down');
            },
            back: function () {
                Lampa.Activity.backward();
            }
        });

        Lampa.Controller.toggle('content');
    };

    WatchPage.prototype.pause = function () {
        if (this.frame) {
            try { this.command('pause'); } catch (e) {}
        }
    };

    WatchPage.prototype.stop = function () {};

    WatchPage.prototype.destroy = function () {
        this.destroyed = true;

        if (this.frame) {
            try { this.frame.src = 'about:blank'; } catch (e) {}
            $(this.frame).remove();
            this.frame = null;
        }

        this.scroll.destroy();
        $(this.html).remove();
    };

    WatchPage.prototype.render = function (js) {
        return js ? this.html : $(this.html);
    };

    // ---------- Меню, поиск, настройки ----------

    function addMenu() {
        var title = tr('rutube_title', MENU_TITLE);
        var sort = Lampa.Storage.get('menu_sort', []);

        if (sort.indexOf(title) < 0) {
            sort.unshift(title);
            Lampa.Storage.set('menu_sort', sort);
        }

        Lampa.Menu.addButton(ICON_MENU, title, openCatalog);
    }

    function addSearchSource() {
        if (!window.Lampa || !Lampa.Search || !Lampa.Search.addSource) return;

        var title = tr('rutube_title', MENU_TITLE);

        Lampa.Search.addSource({
            title: title,
            search: function (params, oncomplite) {
                var queryStr = (params.query || '').trim();

                if (!queryStr) return oncomplite([]);

                apiGet(searchUrl(queryStr, 1), function (err, data) {
                    if (err || !data) return oncomplite([]);

                    var cards = listToCards(data);

                    if (!cards.length) return oncomplite([]);

                    oncomplite([{title: title, results: cards, total: cards.length, total_pages: 1}]);
                });
            },
            onSelect: function (params, close) {
                if (close) close();
                openVideo(params.element);
            }
        });
    }

    function getLampaPlayerLabel() {
        var p = getLampaPlayer();

        if (p === 'inner') return tr('rutube_player_inner', 'Встроенный');
        if (p === 'android') return tr('rutube_player_android', 'Android (внешний)');
        if (p === 'vlc') return 'VLC';
        return p;
    }

    function playerModeDescription() {
        return tr('rutube_mode_descr', 'Основной плеер выбирается в «Настройки → Плеер» (сейчас: {player}).').replace('{player}', getLampaPlayerLabel());
    }

    function qualityDescription() {
        if (isTvOrAndroid()) {
            return tr('rutube_quality_descr_tv', 'Плеер выбирается в «Настройки → Плеер» (сейчас: {player}). Приоритетное качество для плеера Lampa и внешних плееров.').replace('{player}', getLampaPlayerLabel());
        }
        return tr('rutube_quality_descr', 'Используется для плеера Lampa и внешних плееров (Vimu, Just Player)');
    }

    function addSettings() {
        if (!window.Lampa || !Lampa.SettingsApi) return;

        // Авто-миграция числовых значений качества на строковые ключи
        try {
            var legacy = {'1080': 'q1080', '720': 'q720', '480': 'q480', '360': 'q360'};
            var current = String(Lampa.Storage.get('rutube_quality', 'auto'));

            if (legacy[current]) Lampa.Storage.set('rutube_quality', legacy[current]);
        } catch (e) {}

        Lampa.SettingsApi.addComponent({
            component: 'rutube',
            name: tr('rutube_title', MENU_TITLE),
            icon: ICON_MENU
        });

        if (!isTvOrAndroid()) {
            Lampa.SettingsApi.addParam({
                component: 'rutube',
                param: {
                    name: 'rutube_player_mode',
                    type: 'select',
                    values: {
                        direct: tr('rutube_mode_direct', 'Плеер Lampa (из Настройки → Плеер)'),
                        watch: tr('rutube_mode_watch', 'Плеер Rutube (страница с описанием)')
                    },
                    default: 'direct'
                },
                field: {
                    name: tr('rutube_player_mode_name', 'Плеер для Rutube'),
                    description: playerModeDescription()
                },
                onRender: function (item) {
                    if (item && item.find) {
                        var descr = item.find('.settings-param__descr');

                        if (descr.length) descr.text(playerModeDescription());
                    }
                }
            });
        }

        Lampa.SettingsApi.addParam({
            component: 'rutube',
            param: {
                name: 'rutube_quality',
                type: 'select',
                values: {
                    auto: tr('rutube_quality_auto', 'Авто (HLS)'),
                    q1080: '1080p (Full HD)',
                    q720: '720p (HD)',
                    q480: '480p (SD)',
                    q360: '360p'
                },
                default: 'auto'
            },
            field: {
                name: tr('rutube_quality_name', 'Приоритетное качество'),
                description: qualityDescription()
            },
            onRender: function (item) {
                if (item && item.find) {
                    var descr = item.find('.settings-param__descr');

                    if (descr.length) descr.text(qualityDescription());
                }
            }
        });
    }

    function routeHistory() {
        var call = Lampa.Router.call;

        Lampa.Router.call = function (name, data) {
            if (name !== 'full' || !data || data.source !== HISTORY_SOURCE) return call.apply(this, arguments);

            openVideo(stubCard(data));
        };
    }

    function init() {
        initLang();

        var style = document.createElement('style');

        style.textContent = STYLE;
        document.head.appendChild(style);

        Lampa.Component.add('rutube_main', CatalogPage);
        Lampa.Component.add('rutube_section', SectionPage);
        Lampa.Component.add('rutube_search', SearchPage);
        Lampa.Component.add('rutube_video', WatchPage);

        routeHistory();
        addMenu();
        addSettings();
        addSearchSource();
        var hasAndroidBridge = !!(window.AndroidJS && window.Lampa && Lampa.Android && typeof Lampa.Android.httpReq === 'function');
        var lampaPlatform = (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') ? String(Lampa.Storage.get('platform', '') || 'browser') : 'browser';
        console.log('[Rutube] initialized v1.0 platform=' + lampaPlatform + ' tv_or_android=' + isTvOrAndroid() + ' player=' + getLampaPlayer() + ' android_bridge=' + hasAndroidBridge);
    }

    function start() {
        if (!window.Lampa || !Lampa.Listener || !Lampa.Maker) return setTimeout(start, 50);

        if (window.appready) return init();

        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') init();
        });
    }

    start();
})();
