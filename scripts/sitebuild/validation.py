"""Source-data preflight, independent of templates and generated files."""
import datetime
import json
import math
from pathlib import Path, PurePosixPath
import re
from urllib.parse import urlsplit

SOURCE_NAMES = ('site', 'episodes', 'series', 'news', 'page_meta', 'ranking',
                'aliases', 'game_readings', 'game_series')


class ValidationError(ValueError):
    pass


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'duplicate JSON key: {key}')
        result[key] = value
    return result


def _constant(value):
    raise ValueError(f'non-finite JSON number: {value}')


def load_sources(root):
    """Validate all source JSON before any generator can write output."""
    root = Path(root)
    data, errors = {}, []

    def require(condition, field, message):
        if not condition:
            errors.append(f'{field}: {message}')
        return condition

    def obj(value, field):
        return value if require(isinstance(value, dict), field, 'must be an object') else {}

    def array(value, field):
        return value if require(isinstance(value, list), field, 'must be an array') else []

    def string(value, field, empty=False):
        return require(isinstance(value, str) and (empty or bool(value.strip())), field, 'must be a string' + ('' if empty else ' (not blank)'))

    def strings(value, field):
        values = array(value, field)
        for i, item in enumerate(values):
            string(item, f'{field}[{i}]')
        return values

    def integer(value, field, minimum=0):
        return require(type(value) is int and value >= minimum, field, f'must be an integer >= {minimum}')

    def number(value, field):
        return require(type(value) in (int, float) and math.isfinite(value), field, 'must be a finite number')

    def date(value, field):
        if not require(isinstance(value, str) and bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}', value)), field, 'must be YYYY-MM-DD'):
            return
        try:
            datetime.date.fromisoformat(value)
        except ValueError:
            errors.append(f'{field}: invalid calendar date')

    def url(value, field):
        if string(value, field):
            try:
                parsed = urlsplit(value)
                require(parsed.scheme in ('http', 'https') and bool(parsed.netloc), field, 'must be an http(s) URL')
            except ValueError:
                errors.append(f'{field}: invalid URL')

    def image(value, field):
        if value is None or value == '':
            return  # Artwork is optional; the site has numbered placeholders.
        if not string(value, field):
            return
        path = PurePosixPath(value)
        if not require(not path.is_absolute() and '\\' not in value and ':' not in value and '..' not in path.parts,
                       field, 'must be a site-relative image path'):
            return
        target = root / path
        if not require(target.is_file(), field, f'image not found: {value}'):
            return
        current = root
        for part in path.parts:
            if not require(part in {p.name for p in current.iterdir()}, field, f'image path case mismatch: {value}'):
                break
            current /= part

    def unique(values, field):
        require(len(values) == len(set(values)), field, 'duplicate values')

    for name in SOURCE_NAMES:
        field = f'data/{name}.json'
        try:
            raw = json.loads((root / field).read_text(encoding='utf-8'), object_pairs_hook=_object, parse_constant=_constant)
            data[name] = obj(raw, field)
        except (OSError, ValueError) as error:
            errors.append(f'{field}: {error}')
            data[name] = {}

    series = array(data['series'].get('series'), 'series.json.series')
    slugs = []
    for i, raw in enumerate(series):
        field = f'series.json.series[{i}]'
        item = obj(raw, field)
        slug = item.get('slug')
        if string(slug, field + '.slug'):
            require(bool(re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug)), field + '.slug', 'use lowercase letters, numbers and hyphens')
            slugs.append(slug)
        for key in ('name', 'icon', 'description'):
            string(item.get(key), field + '.' + key)
    unique(slugs, 'series.json.series.slug')

    episodes = array(data['episodes'].get('episodes'), 'episodes.json.episodes')
    require(bool(episodes), 'episodes.json.episodes', 'must not be empty')
    numbers = []
    for i, raw in enumerate(episodes):
        field = f'episodes.json.episodes[{i}]'
        ep = obj(raw, field)
        if integer(ep.get('number'), field + '.number'):
            numbers.append(ep['number'])
        string(ep.get('title'), field + '.title')
        string(ep.get('description'), field + '.description', empty=True)
        date(ep.get('date'), field + '.date')
        for key in ('tags', 'games'):
            strings(ep.get(key), field + '.' + key)
        for key in ('featured_games', 'sanbun_games'):
            if key in ep:
                strings(ep[key], field + '.' + key)
        require('series' in ep and (ep['series'] is None or isinstance(ep['series'], str) and ep['series'] in slugs), field + '.series', 'unknown or missing series')
        for j, raw_chapter in enumerate(array(ep.get('chapters'), field + '.chapters')):
            loc = f'{field}.chapters[{j}]'
            chapter = obj(raw_chapter, loc)
            string(chapter.get('label'), loc + '.label')
            t = chapter.get('time')
            require(isinstance(t, str) and bool(re.fullmatch(r'\d+:[0-5]\d(?::[0-5]\d)?', t)), loc + '.time', 'must be mm:ss or h:mm:ss')
        for key, value in obj(ep.get('links'), field + '.links').items():
            if value:
                url(value, field + '.links.' + key)
        for key in ('audio', 'image_src'):
            if ep.get(key):
                url(ep[key], field + '.' + key)
        if 'duration' in ep:
            integer(ep['duration'], field + '.duration')
        for key in ('locked', 'date_estimated'):
            if key in ep:
                require(type(ep[key]) is bool, field + '.' + key, 'must be a boolean')
        image(ep.get('image'), field + '.image')
    unique(numbers, 'episodes.json.episodes.number')
    require(numbers == sorted(numbers), 'episodes.json.episodes', 'must be ordered by episode number')

    site = data['site']
    for key in ('title', 'tagline', 'schedule', 'hashtag', 'email', 'privacy_date', 'x_handle', 'instagram_handle'):
        string(site.get(key), 'site.json.' + key)
    for key in ('title_suffix', 'ga_id'):
        if key in site:
            string(site[key], 'site.json.' + key, empty=True)
    for key in ('base_url', 'rss', 'x_url', 'instagram_url', 'otayori_form'):
        url(site.get(key), 'site.json.' + key)
    if isinstance(site.get('base_url'), str):
        try:
            base = urlsplit(site['base_url'])
            require(not base.query and not base.fragment, 'site.json.base_url', 'must not contain a query or fragment')
        except ValueError:
            pass
    recommended = array(site.get('recommended_episodes'), 'site.json.recommended_episodes')
    require(len(recommended) == 4 and all(type(n) is int and n in numbers for n in recommended), 'site.json.recommended_episodes', 'must contain four existing episode numbers')
    unique([n for n in recommended if type(n) is int], 'site.json.recommended_episodes')
    featured = strings(site.get('featured_series'), 'site.json.featured_series')
    require(all(isinstance(s, str) and s in slugs for s in featured), 'site.json.featured_series', 'unknown series')
    services = obj(site.get('services'), 'site.json.services')
    require(bool(services) and set(services) <= {'spotify', 'apple', 'amazon', 'listen', 'youtube'}, 'site.json.services', 'unknown or empty services')
    for key, raw in services.items():
        service = obj(raw, 'site.json.services.' + key)
        string(service.get('label'), f'site.json.services.{key}.label')
        url(service.get('url'), f'site.json.services.{key}.url')
    members = array(site.get('members'), 'site.json.members')
    require(bool(members), 'site.json.members', 'must not be empty')
    for i, raw in enumerate(members):
        field = f'site.json.members[{i}]'
        member = obj(raw, field)
        for key in ('id', 'name', 'bio', 'x_handle'):
            string(member.get(key), field + '.' + key)
        url(member.get('x'), field + '.x')
        if 'blog' in member:
            blog = obj(member['blog'], field + '.blog')
            string(blog.get('label'), field + '.blog.label')
            url(blog.get('url'), field + '.blog.url')

    news_slugs, news_dates = [], []
    for i, raw in enumerate(array(data['news'].get('news'), 'news.json.news')):
        field = f'news.json.news[{i}]'
        item = obj(raw, field)
        slug = item.get('slug')
        if string(slug, field + '.slug'):
            require(bool(re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug)), field + '.slug', 'invalid slug')
            news_slugs.append(slug)
        date(item.get('date'), field + '.date')
        if isinstance(item.get('date'), str):
            news_dates.append(item['date'])
        string(item.get('title'), field + '.title')
        require(bool(strings(item.get('body'), field + '.body')), field + '.body', 'must not be empty')
    unique(news_slugs, 'news.json.news.slug')
    require(news_dates == sorted(news_dates), 'news.json.news', 'must be ordered by date')
    meta = data['page_meta']
    require(set(meta) == {'guide.html', 'otayori.html', 'privacy.html'}, 'page_meta.json', 'expected guide.html, otayori.html and privacy.html')
    for key, raw in meta.items():
        item = obj(raw, 'page_meta.json.' + key)
        require('updated' in item, 'page_meta.json.' + key, 'missing updated')
        if item.get('updated') is not None:
            date(item['updated'], f'page_meta.json.{key}.updated')

    ranking = data['ranking']
    season_numbers = []
    for i, raw in enumerate(array(ranking.get('seasons'), 'ranking.json.seasons')):
        field = f'ranking.json.seasons[{i}]'
        season = obj(raw, field)
        if integer(season.get('season'), field + '.season', 1):
            season_numbers.append(season['season'])
        string(season.get('label'), field + '.label')
        require(type(season.get('active')) is bool, field + '.active', 'must be a boolean')
        for key in ('start_round', 'through_round'):
            if season.get(key) is not None:
                integer(season[key], field + '.' + key)
        for key in ('entries', 'ranking'):
            for j, raw_row in enumerate(array(season.get(key), field + '.' + key)):
                loc = f'{field}.{key}[{j}]'
                row = obj(raw_row, loc)
                string(row.get('listener'), loc + '.listener')
                number(row.get('points'), loc + '.points')
                for count in (('round',) if key == 'entries' else ('rank', 'awards')):
                    # Historical AWQ scores may intentionally have no round.
                    if count == 'round' and 'round' in row and row['round'] is None:
                        continue
                    integer(row.get(count), loc + '.' + count)
    unique(season_numbers, 'ranking.json.seasons.season')
    quiz_rounds = []
    for i, raw in enumerate(array(ranking.get('quizzes'), 'ranking.json.quizzes')):
        field = f'ranking.json.quizzes[{i}]'
        quiz = obj(raw, field)
        # AWQ questions may be published before the answer episode reaches RSS.
        # The page already renders a pending answer without an episode link.
        if integer(quiz.get('round'), field + '.round', 1):
            quiz_rounds.append(quiz['round'])
        image(quiz.get('image'), field + '.image')
        if quiz.get('x_url'):
            url(quiz['x_url'], field + '.x_url')
    unique(quiz_rounds, 'ranking.json.quizzes.round')

    for i, raw in enumerate(array(data['aliases'].get('titles'), 'aliases.json.titles')):
        item = obj(raw, f'aliases.json.titles[{i}]')
        string(item.get('canonical'), f'aliases.json.titles[{i}].canonical')
        strings(item.get('aliases'), f'aliases.json.titles[{i}].aliases')
    for key, value in obj(data['game_readings'].get('readings'), 'game_readings.json.readings').items():
        string(value, 'game_readings.json.readings.' + key)
    for key, raw in obj(data['game_series'].get('series'), 'game_series.json.series').items():
        field = 'game_series.json.series.' + key
        item = obj(raw, field)
        if 'stem' in item:
            string(item['stem'], field + '.stem')
        for name in ('add', 'remove'):
            if name in item:
                strings(item[name], field + '.' + name)
    if errors:
        raise ValidationError('Source validation failed:\n- ' + '\n- '.join(errors))
    return data
