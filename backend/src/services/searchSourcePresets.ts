import { SearchSourceConfig } from './SearchCrawler.js'

// ── Type extension: add group tag for UI grouping ─────────────────────────────
export interface TaggedPreset extends SearchSourceConfig {
  group: 'torrent' | 'streaming' | 'video' | 'iptv' | 'adult' | 'anime' | 'utility' | 'playlist'
  description?: string
}

export const SEARCH_SOURCE_PRESETS: TaggedPreset[] = [

  // ════════════════════════════════════════════════════════════════
  // TOP-5 PLAYLIST DISCOVERY  (M3U8/M3U/PLS/XSPF/ASX/WPL/STRM)
  // ════════════════════════════════════════════════════════════════

  {
    id: 'playlist-github-m3u8',
    name: 'GitHub — M3U8 Playlists',
    group: 'playlist',
    description: 'Top source: search GitHub for M3U8 playlist files across all public repos',
    baseUrl: 'https://github.com/search',
    searchMethod: 'url',
    urlTemplate: 'https://github.com/search?q={query}+extension%3Am3u8&type=code',
    resultSelectors: {
      containerSelector: 'div.code-list-item',
      linkSelector:      'a.Link--primary',
      titleSelector:     'a.Link--primary',
      thumbnailSelector: '',
    },
  },
  {
    id: 'playlist-github-iptv',
    name: 'GitHub — IPTV Playlist Files',
    group: 'playlist',
    description: 'Top source: search GitHub for M3U/XSPF/PLS playlist files',
    baseUrl: 'https://github.com/search',
    searchMethod: 'url',
    urlTemplate: 'https://github.com/search?q={query}+extension%3Am3u&type=code',
    resultSelectors: {
      containerSelector: 'div.code-list-item',
      linkSelector:      'a.Link--primary',
      titleSelector:     'a.Link--primary',
      thumbnailSelector: '',
    },
  },
  {
    id: 'playlist-pastebin-m3u8',
    name: 'Pastebin — M3U8 Search',
    group: 'playlist',
    description: 'Top source: Pastebin search for pasted M3U8 playlists and IPTV links',
    baseUrl: 'https://pastebin.com',
    searchMethod: 'url',
    urlTemplate: 'https://pastebin.com/search?q={query}+m3u8',
    resultSelectors: {
      containerSelector: '.search-result',
      linkSelector:      'a.i_p_author',
      titleSelector:     'a.i_p_author',
      thumbnailSelector: '',
    },
  },
  {
    id: 'playlist-iptvcat-search',
    name: 'IPTV Cat — Stream Search',
    group: 'playlist',
    description: 'Top source: IPTV Cat live stream database with M3U8 export per result',
    baseUrl: 'https://iptvcat.net',
    searchMethod: 'url',
    urlTemplate: 'https://iptvcat.net/search/{query}',
    resultSelectors: {
      containerSelector: 'table tbody tr',
      linkSelector:      'td a',
      titleSelector:     'td:first-child',
      thumbnailSelector: '',
    },
  },
  {
    id: 'playlist-xtream-codes',
    name: 'Xtream Codes — Public Panels',
    group: 'playlist',
    description: 'Top source: public Xtream Codes API panels (VOD + Live + Series in M3U/API format)',
    baseUrl: 'https://github.com/search',
    searchMethod: 'url',
    urlTemplate: 'https://github.com/search?q={query}+xtream+codes+m3u&type=repositories',
    resultSelectors: {
      containerSelector: 'ul.repo-list li',
      linkSelector:      'a[itemprop="name codeRepository"]',
      titleSelector:     'a[itemprop="name codeRepository"]',
      thumbnailSelector: '',
    },
  },

  // ════════════════════════════════════════════════════════════════
  // TORRENT INDEXERS  (direct web equivalents of Prowlarr indexers)
  // ════════════════════════════════════════════════════════════════

  {
    id: '1337x',
    name: '1337x',
    group: 'torrent',
    description: 'General torrent index — movies, TV, games, software',
    baseUrl: 'https://1337x.to/',
    searchMethod: 'url',
    urlTemplate: 'https://1337x.to/search/{query}/1/',
    resultSelectors: {
      containerSelector: 'tbody tr',
      linkSelector: 'td.name a:nth-child(2)',
      titleSelector: 'td.name a:nth-child(2)',
      thumbnailSelector: '',
      metadataSelectors: {
        seeders:  'td.seeds',
        leechers: 'td.leeches',
        size:     'td.size',
        date:     'td.coll-date',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://1337x.to/search/{query}/{page}/',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'yts',
    name: 'YTS',
    group: 'torrent',
    description: 'High-quality movie torrents with 720p–4K encodes',
    baseUrl: 'https://yts.mx/',
    searchMethod: 'url',
    urlTemplate: 'https://yts.mx/browse-movies/{query}/all/all/0/latest/0/all',
    resultSelectors: {
      containerSelector: '.browse-movie-wrap',
      linkSelector: 'a.browse-movie-link',
      titleSelector: '.browse-movie-title',
      thumbnailSelector: 'img.img-responsive',
      metadataSelectors: {
        year:   '.browse-movie-year',
        rating: '.rating',
        genre:  '.browse-movie-tags a',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://yts.mx/browse-movies/{query}/all/all/0/latest/0/all?page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'eztv',
    name: 'EZTV',
    group: 'torrent',
    description: 'TV episode torrents — vast archive of series',
    baseUrl: 'https://eztv.re/',
    searchMethod: 'url',
    urlTemplate: 'https://eztv.re/search/{query}',
    resultSelectors: {
      containerSelector: 'tr.forum_header_border',
      linkSelector: 'td a.magnet',
      titleSelector: 'td.forum_thread_post a.epinfo',
      thumbnailSelector: '',
      metadataSelectors: {
        size:    'td:nth-child(4)',
        seeders: 'td.forum_thread_post_end b',
        date:    'td:nth-child(5)',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://eztv.re/search/{query}?page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'limetorrents',
    name: 'LimeTorrents',
    group: 'torrent',
    description: 'General torrent index with good movie/TV coverage',
    baseUrl: 'https://www.limetorrents.lol/',
    searchMethod: 'url',
    urlTemplate: 'https://www.limetorrents.lol/search/all/{query}/',
    resultSelectors: {
      containerSelector: '#hor-minimalist-b tbody tr',
      linkSelector: 'td.tdleft a:nth-child(2)',
      titleSelector: 'td.tdleft a:nth-child(2)',
      thumbnailSelector: '',
      metadataSelectors: {
        date:     'td.tdnormal:nth-child(2)',
        size:     'td.tdnormal:nth-child(3)',
        seeders:  'td.tdseed',
        leechers: 'td.tdleech',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://www.limetorrents.lol/search/all/{query}/page/{page}/',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'the-pirate-bay',
    name: 'The Pirate Bay',
    group: 'torrent',
    description: 'The original public torrent index',
    baseUrl: 'https://thepiratebay.org/',
    searchMethod: 'url',
    urlTemplate: 'https://thepiratebay.org/search.php?q={query}&cat=0',
    resultSelectors: {
      containerSelector: '#searchResult tbody tr',
      linkSelector: 'td div.detName a',
      titleSelector: 'td div.detName a',
      thumbnailSelector: '',
      metadataSelectors: {
        seeders:  'td:nth-child(3)',
        leechers: 'td:nth-child(4)',
        size:     'td font.detDesc',
        uploader: 'td font.detDesc a',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://thepiratebay.org/search.php?q={query}&cat=0&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'torrent-galaxy',
    name: 'TorrentGalaxy',
    group: 'torrent',
    description: 'Modern torrent tracker with rich metadata',
    baseUrl: 'https://torrentgalaxy.to/',
    searchMethod: 'url',
    urlTemplate: 'https://torrentgalaxy.to/torrents.php?search={query}',
    resultSelectors: {
      containerSelector: 'div.tgxtablerow',
      linkSelector: 'div.tgxtablecell a.txlight',
      titleSelector: 'div.tgxtablecell a.txlight',
      thumbnailSelector: '',
      metadataSelectors: {
        seeders:  'span.tgxtdseeds',
        size:     'span.badge-secondary',
        category: 'div.tgxtablecell a[href*="cat"]',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://torrentgalaxy.to/torrents.php?search={query}&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'rarbg-mirror',
    name: 'RARBG Mirror (rargb.to)',
    group: 'torrent',
    description: 'RARBG mirror — movies, TV, games with quality encodes',
    baseUrl: 'https://rargb.to/',
    searchMethod: 'url',
    urlTemplate: 'https://rargb.to/search/?search={query}',
    resultSelectors: {
      containerSelector: 'tr.lista2',
      linkSelector: 'td:nth-child(2) a:nth-child(2)',
      titleSelector: 'td:nth-child(2) a:nth-child(2)',
      thumbnailSelector: '',
      metadataSelectors: {
        category: 'td:nth-child(3) a',
        size:     'td:nth-child(4)',
        seeders:  'td:nth-child(5) font',
        leechers: 'td:nth-child(6)',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://rargb.to/search/?search={query}&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'kickass-torrents',
    name: 'KickassTorrents',
    group: 'torrent',
    description: 'Classic torrent indexer — movies, TV, music',
    baseUrl: 'https://katcr.co/',
    searchMethod: 'url',
    urlTemplate: 'https://katcr.co/usearch/{query}/',
    resultSelectors: {
      containerSelector: 'table.data tr:not(.firstr)',
      linkSelector: 'td.rowTitle a.cellMainLink',
      titleSelector: 'td.rowTitle a.cellMainLink',
      thumbnailSelector: '',
      metadataSelectors: {
        size:     'td[data-title="size"]',
        seeders:  'td[data-title="seed"] span',
        leechers: 'td[data-title="leech"]',
        date:     'td[data-title="added"]',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://katcr.co/usearch/{query}/{page}/',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'zooqle',
    name: 'Zooqle',
    group: 'torrent',
    description: 'Verified torrent indexer with IMDb integration',
    baseUrl: 'https://zooqle.com/',
    searchMethod: 'url',
    urlTemplate: 'https://zooqle.com/search?q={query}',
    resultSelectors: {
      containerSelector: 'tr.search-row',
      linkSelector: 'td.znrow-ttl a',
      titleSelector: 'td.znrow-ttl a',
      thumbnailSelector: '',
      metadataSelectors: {
        seeders: 'td.znrow-se span.seed',
        size:    'td.znrow-size',
        category: 'td.znrow-cat span',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://zooqle.com/search?q={query}&pg={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'torrentz2',
    name: 'Torrentz2',
    group: 'torrent',
    description: 'Meta-search across multiple torrent indexes',
    baseUrl: 'https://torrentz2.nz/',
    searchMethod: 'url',
    urlTemplate: 'https://torrentz2.nz/search?q={query}',
    resultSelectors: {
      containerSelector: 'dl',
      linkSelector: 'dt a',
      titleSelector: 'dt a',
      thumbnailSelector: '',
      metadataSelectors: {
        size:    'dd span.size',
        seeders: 'dd span.seeds',
        date:    'dd span.age',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://torrentz2.nz/search?q={query}&p={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'magnetdl',
    name: 'MagnetDL',
    group: 'torrent',
    description: 'Magnet links index with clean listings',
    baseUrl: 'https://www.magnetdl.com/',
    searchMethod: 'url',
    urlTemplate: 'https://www.magnetdl.com/search/?q={query}',
    resultSelectors: {
      containerSelector: 'table.download tbody tr',
      linkSelector: 'td.n a',
      titleSelector: 'td.n a',
      thumbnailSelector: '',
      metadataSelectors: {
        size:    'td.s',
        seeders: 'td.se',
        date:    'td.age',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://www.magnetdl.com/search/?q={query}&p={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'rutracker',
    name: 'Rutracker',
    group: 'torrent',
    description: 'Russian tracker — massive library of movies, TV, music, books (free account required)',
    baseUrl: 'https://rutracker.org/',
    searchMethod: 'url',
    urlTemplate: 'https://rutracker.org/forum/tracker.php?nm={query}',
    resultSelectors: {
      containerSelector: 'table#tor-tbl tbody tr',
      linkSelector: 'td.t-title a.tLink',
      titleSelector: 'td.t-title a.tLink',
      thumbnailSelector: '',
      metadataSelectors: {
        category: 'td.f-name a',
        size:     'td.tor-size u',
        seeders:  'td.seedmed b',
        date:     'td.nowrap u',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://rutracker.org/forum/tracker.php?nm={query}&start={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'torlock',
    name: 'Torlock',
    group: 'torrent',
    description: 'Verified-only torrent index — movies, TV, anime, games, software',
    baseUrl: 'https://www.torlock.com/',
    searchMethod: 'url',
    urlTemplate: 'https://www.torlock.com/all/torrents/{query}.html',
    resultSelectors: {
      containerSelector: 'table.table tbody tr',
      linkSelector: 'td a[href*="/torrent/"]',
      titleSelector: 'td a[href*="/torrent/"]',
      thumbnailSelector: '',
      metadataSelectors: {
        size:    'td:nth-child(2)',
        date:    'td:nth-child(3)',
        seeders: 'td:nth-child(4)',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://www.torlock.com/all/torrents/{query}.html?p={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'idope',
    name: 'iDope',
    group: 'torrent',
    description: 'DHT-based torrent search — 17M+ torrents, no registration',
    baseUrl: 'https://idope.se/',
    searchMethod: 'url',
    urlTemplate: 'https://idope.se/torrent-list/{query}/',
    resultSelectors: {
      containerSelector: 'div.resultdiv',
      linkSelector: 'div.resultdivtop a',
      titleSelector: 'div.resultdivtopname',
      thumbnailSelector: '',
      metadataSelectors: {
        size:    'div.resultdivbotton div:nth-child(2)',
        seeders: 'div.resultdivbotton div:nth-child(3)',
        date:    'div.resultdivbotton div:nth-child(4)',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://idope.se/torrent-list/{query}/?p={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'bitsearch',
    name: 'Bitsearch',
    group: 'torrent',
    description: 'DHT crawler search engine — fast, no-JS results page',
    baseUrl: 'https://bitsearch.to/',
    searchMethod: 'url',
    urlTemplate: 'https://bitsearch.to/search?q={query}&category=1',
    resultSelectors: {
      containerSelector: 'li.search-result',
      linkSelector: 'h5.title a',
      titleSelector: 'h5.title a',
      thumbnailSelector: '',
      metadataSelectors: {
        size:    'li span[title="Size"]',
        seeders: 'li span[title="Seeders"]',
        date:    'li span[title="Date"]',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://bitsearch.to/search?q={query}&category=1&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'bt4g',
    name: 'BT4G',
    group: 'torrent',
    description: 'BitTorrent DHT search engine — lightweight, no-JS',
    baseUrl: 'https://bt4g.com/',
    searchMethod: 'url',
    urlTemplate: 'https://bt4g.com/search/{query}/1',
    resultSelectors: {
      containerSelector: 'div.col-xl-8 div.card',
      linkSelector: 'div.card-body a.title',
      titleSelector: 'div.card-body a.title',
      thumbnailSelector: '',
      metadataSelectors: {
        size:    'span.badge-info',
        seeders: 'span.badge-success',
        date:    'small.text-muted',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://bt4g.com/search/{query}/{page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'torrentdownloads',
    name: 'TorrentDownloads',
    group: 'torrent',
    description: 'Large general torrent index — movies, TV, games, software',
    baseUrl: 'https://www.torrentdownloads.pro/',
    searchMethod: 'url',
    urlTemplate: 'https://www.torrentdownloads.pro/search/?search={query}',
    resultSelectors: {
      containerSelector: 'div#pager_links p.inner_listing',
      linkSelector: 'a[href*="/torrent/"]',
      titleSelector: 'a[href*="/torrent/"]',
      thumbnailSelector: '',
      metadataSelectors: {
        seeders: 'span.green_number',
        size:    'span.tor_size',
        date:    'span.tor_date',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://www.torrentdownloads.pro/search/?search={query}&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'solidtorrents',
    name: 'Solid Torrents',
    group: 'torrent',
    description: 'DHT-based index with clean UI and torrent stats',
    baseUrl: 'https://solidtorrents.to/',
    searchMethod: 'url',
    urlTemplate: 'https://solidtorrents.to/search?q={query}&category=Video',
    resultSelectors: {
      containerSelector: 'div.search-result',
      linkSelector: 'h5.title a',
      titleSelector: 'h5.title a',
      thumbnailSelector: '',
      metadataSelectors: {
        size:     'li span[title="Total Size"]',
        seeders:  'li.seed-count',
        leechers: 'li.leech-count',
        date:     'li.date',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://solidtorrents.to/search?q={query}&category=Video&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'btdigg',
    name: 'BTDigg',
    group: 'torrent',
    description: 'BitTorrent DHT search — finds rare and obscure torrents',
    baseUrl: 'https://btdig.com/',
    searchMethod: 'url',
    urlTemplate: 'https://btdig.com/search?q={query}&p=0&order=0',
    resultSelectors: {
      containerSelector: 'div.one_result',
      linkSelector: 'div.torrent_name a',
      titleSelector: 'div.torrent_name a',
      thumbnailSelector: '',
      metadataSelectors: {
        size: 'div.torrent_size',
        date: 'div.torrent_age',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://btdig.com/search?q={query}&p={page}&order=0',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'glodls',
    name: 'GloDLS',
    group: 'torrent',
    description: 'Community torrent tracker — similar layout to TPB',
    baseUrl: 'https://glodls.to/',
    searchMethod: 'url',
    urlTemplate: 'https://glodls.to/search_results.php?search={query}&cat=0',
    resultSelectors: {
      containerSelector: 'table#hor-minimalist-b tbody tr',
      linkSelector: 'td a[href*="torrent"]',
      titleSelector: 'td a[href*="torrent"]',
      thumbnailSelector: '',
      metadataSelectors: {
        size:    'td:nth-child(4)',
        seeders: 'td:nth-child(6)',
        date:    'td:nth-child(3)',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://glodls.to/search_results.php?search={query}&cat=0&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'torrentfunk',
    name: 'TorrentFunk',
    group: 'torrent',
    description: 'Verified torrent index — movies, TV shows, games, apps',
    baseUrl: 'https://www.torrentfunk.com/',
    searchMethod: 'url',
    urlTemplate: 'https://www.torrentfunk.com/all/torrents/{query}.html',
    resultSelectors: {
      containerSelector: 'table.tmain tbody tr',
      linkSelector: 'td a[href*="torrent"]',
      titleSelector: 'td a[href*="torrent"]',
      thumbnailSelector: '',
      metadataSelectors: {
        size:    'td:nth-child(3)',
        seeders: 'td:nth-child(4)',
        date:    'td:nth-child(2)',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://www.torrentfunk.com/all/torrents/{query}.html?p={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'torrentseeker',
    name: 'TorrentSeeker',
    group: 'torrent',
    description: 'Meta-search across 20+ torrent sites simultaneously',
    baseUrl: 'https://torrentseeker.com/',
    searchMethod: 'url',
    urlTemplate: 'https://torrentseeker.com/?q={query}',
    resultSelectors: {
      containerSelector: 'div.result-item',
      linkSelector: 'a.result-title',
      titleSelector: 'a.result-title',
      thumbnailSelector: '',
      metadataSelectors: {
        size:    'span.result-size',
        seeders: 'span.result-seeders',
        source:  'span.result-source',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://torrentseeker.com/?q={query}&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  // ════════════════════════════════════════════════════════════════
  // FREE STREAMING PLATFORMS
  // ════════════════════════════════════════════════════════════════

  {
    id: 'archive-org',
    name: 'Internet Archive — Movies',
    group: 'streaming',
    description: 'Free legal streaming of public domain movies, TV, audio',
    baseUrl: 'https://archive.org/',
    searchMethod: 'url',
    urlTemplate: 'https://archive.org/search?query={query}&and[]=mediatype%3Amovies',
    resultSelectors: {
      containerSelector: 'div.item-ia',
      linkSelector: 'a.stealth',
      titleSelector: 'div.ttl',
      thumbnailSelector: 'div.item-img img',
      metadataSelectors: {
        description: 'div.by',
        views:       'span.downloads',
        date:        'span.pubdate',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://archive.org/search?query={query}&and[]=mediatype%3Amovies&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'archive-org-tv',
    name: 'Internet Archive — TV & Series',
    group: 'streaming',
    description: 'Public domain TV shows and series episodes from the Internet Archive',
    baseUrl: 'https://archive.org/',
    searchMethod: 'url',
    urlTemplate: 'https://archive.org/search?query={query}&and[]=mediatype%3Amovies&and[]=subject%3Atelevision',
    resultSelectors: {
      containerSelector: 'div.item-ia',
      linkSelector: 'a.stealth',
      titleSelector: 'div.ttl',
      thumbnailSelector: 'div.item-img img',
      metadataSelectors: { description: 'div.by', date: 'span.pubdate' },
    },
    pagination: {
      pageUrlTemplate: 'https://archive.org/search?query={query}&and[]=mediatype%3Amovies&and[]=subject%3Atelevision&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'archive-org-audio',
    name: 'Internet Archive — Audio',
    group: 'streaming',
    description: 'Public domain audio, music, podcasts, and radio from archive.org',
    baseUrl: 'https://archive.org/',
    searchMethod: 'url',
    urlTemplate: 'https://archive.org/search?query={query}&and[]=mediatype%3Aaudio',
    resultSelectors: {
      containerSelector: 'div.item-ia',
      linkSelector: 'a.stealth',
      titleSelector: 'div.ttl',
      thumbnailSelector: 'div.item-img img',
      metadataSelectors: { description: 'div.by', date: 'span.pubdate' },
    },
    pagination: {
      pageUrlTemplate: 'https://archive.org/search?query={query}&and[]=mediatype%3Aaudio&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'archive-org-api',
    name: 'Internet Archive — Advanced Search API',
    group: 'streaming',
    description: 'Direct JSON API search across all archive.org video/audio collections',
    baseUrl: 'https://archive.org/',
    searchMethod: 'url',
    urlTemplate: 'https://archive.org/advancedsearch.php?q={query}+AND+(mediatype:movies+OR+mediatype:audio)&fl[]=identifier,title,mediatype,description&output=json&rows=50',
    resultSelectors: {
      containerSelector: 'div.item-ia',
      linkSelector: 'a.stealth',
      titleSelector: 'div.ttl',
      thumbnailSelector: 'div.item-img img',
    },
    pagination: { maxPages: 3 },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'odysee',
    name: 'Odysee (LBRY)',
    group: 'streaming',
    description: 'Decentralised video platform — movies, documentaries, vlogs',
    baseUrl: 'https://odysee.com/',
    searchMethod: 'url',
    urlTemplate: 'https://odysee.com/$/search?q={query}',
    resultSelectors: {
      containerSelector: 'li.search-result__wrapper',
      linkSelector: 'a.media__thumb',
      titleSelector: 'h2.media__title',
      thumbnailSelector: 'img.media__thumb--image',
      metadataSelectors: {
        channel: 'span.channel-name',
        views:   'span.media__subtitle',
        date:    'time.media__date',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://odysee.com/$/search?q={query}&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 30000 },
  },

  {
    id: 'rumble',
    name: 'Rumble',
    group: 'streaming',
    description: 'Alternative video platform — news, sports, entertainment',
    baseUrl: 'https://rumble.com/',
    searchMethod: 'url',
    urlTemplate: 'https://rumble.com/search/video?q={query}',
    resultSelectors: {
      containerSelector: 'li.video-listing-entry',
      linkSelector: 'a.videoLink',
      titleSelector: 'h3.title',
      thumbnailSelector: 'img.video-item--img',
      metadataSelectors: {
        views:   'span.video-item--views',
        date:    'time.video-item--time',
        channel: 'a.video-item--a',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://rumble.com/search/video?q={query}&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'bitchute',
    name: 'BitChute',
    group: 'streaming',
    description: 'Peer-to-peer video platform',
    baseUrl: 'https://www.bitchute.com/',
    searchMethod: 'url',
    urlTemplate: 'https://www.bitchute.com/search/?query={query}&kind=video',
    resultSelectors: {
      containerSelector: 'div.channel-card',
      linkSelector: 'a.spa',
      titleSelector: 'p.video-card-title',
      thumbnailSelector: 'img.channel-banner',
      metadataSelectors: {
        channel: 'p.video-card-channel',
        views:   'span.video-views',
        date:    'span.video-publish-date',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://www.bitchute.com/search/?query={query}&kind=video&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'peertube-sepiasearch',
    name: 'PeerTube (SepiaSearch)',
    group: 'streaming',
    description: 'Federated video — searches across all PeerTube instances',
    baseUrl: 'https://sepiasearch.org/',
    searchMethod: 'url',
    urlTemplate: 'https://sepiasearch.org/?search={query}',
    resultSelectors: {
      containerSelector: 'my-video-miniature',
      linkSelector: 'a.video-miniature-name',
      titleSelector: 'a.video-miniature-name',
      thumbnailSelector: 'img.video-miniature-thumbnail',
      metadataSelectors: {
        channel:  '.video-miniature-account',
        duration: '.video-miniature-duration',
        instance: '.video-miniature-host',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://sepiasearch.org/?search={query}&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 30000 },
  },

  {
    id: 'tubi',
    name: 'Tubi TV',
    group: 'streaming',
    description: 'Free ad-supported streaming — 50 000+ movies & shows',
    baseUrl: 'https://tubitv.com/',
    searchMethod: 'url',
    urlTemplate: 'https://tubitv.com/search?q={query}',
    resultSelectors: {
      containerSelector: 'div[data-testid="content-item"]',
      linkSelector: 'a[data-testid="content-item-anchor"]',
      titleSelector: 'span[data-testid="content-item-title"]',
      thumbnailSelector: 'img[data-testid="content-item-image"]',
      metadataSelectors: {
        rating: 'span[data-testid="rating"]',
        year:   'span[data-testid="year"]',
      },
    },
    pagination: { maxPages: 3 },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 30000 },
  },

  {
    id: 'pluto-tv',
    name: 'Pluto TV',
    group: 'iptv',
    description: 'Free live TV + VOD — 250+ live channels',
    baseUrl: 'https://pluto.tv/',
    searchMethod: 'url',
    urlTemplate: 'https://pluto.tv/en/search#q={query}',
    resultSelectors: {
      containerSelector: 'div[class*="Card_container"]',
      linkSelector: 'a[class*="Card_link"]',
      titleSelector: 'p[class*="Card_title"]',
      thumbnailSelector: 'img[class*="Card_image"]',
      metadataSelectors: {
        type: 'p[class*="Card_type"]',
      },
    },
    pagination: { maxPages: 2 },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 35000 },
  },

  // ════════════════════════════════════════════════════════════════
  // IPTV / M3U PLAYLIST SOURCES
  // ════════════════════════════════════════════════════════════════

  {
    id: 'iptv-org-all',
    name: 'IPTV-Org (All Channels)',
    group: 'iptv',
    description: 'iptv-org/iptv community M3U — 8000+ free live channels',
    baseUrl: 'https://iptv-org.github.io/',
    searchMethod: 'url',
    // This returns the raw M3U; SearchCrawler will harvest all URLs
    urlTemplate: 'https://iptv-org.github.io/iptv/index.m3u',
    resultSelectors: {
      containerSelector: 'body',
      linkSelector: 'a',
      titleSelector: 'title',
      thumbnailSelector: '',
    },
    pagination: { maxPages: 1 },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'free-iptv-github',
    name: 'Free-IPTV Lists (GitHub)',
    group: 'iptv',
    description: 'Aggregated community IPTV M3U playlists',
    baseUrl: 'https://raw.githubusercontent.com/',
    searchMethod: 'url',
    urlTemplate: 'https://raw.githubusercontent.com/Free-IPTV/Countries/master/index.m3u',
    resultSelectors: {
      containerSelector: 'body',
      linkSelector: 'a',
      titleSelector: 'title',
      thumbnailSelector: '',
    },
    pagination: { maxPages: 1 },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'iptv-cat',
    name: 'IPTV Cat',
    group: 'iptv',
    description: 'Searchable IPTV channel directory',
    baseUrl: 'https://iptv.cat/',
    searchMethod: 'url',
    urlTemplate: 'https://iptv.cat/search?q={query}',
    resultSelectors: {
      containerSelector: '.channel-item',
      linkSelector: 'a.channel-link',
      titleSelector: '.channel-name',
      thumbnailSelector: '.channel-logo',
      metadataSelectors: {
        country:  '.channel-country',
        language: '.channel-language',
        category: '.channel-category',
      },
    },
    pagination: { maxPages: 5 },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'streamtp',
    name: 'StreamTP',
    group: 'iptv',
    description: 'Free sports & live TV streams',
    baseUrl: 'https://streamtp.com/',
    searchMethod: 'url',
    urlTemplate: 'https://streamtp.com/?q={query}',
    resultSelectors: {
      containerSelector: '.stream-card',
      linkSelector: 'a.stream-link',
      titleSelector: '.stream-title',
      thumbnailSelector: '.stream-thumbnail img',
      metadataSelectors: {
        category: '.stream-category',
        quality:  '.stream-quality',
      },
    },
    pagination: { maxPages: 3 },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 20000 },
  },

  // ════════════════════════════════════════════════════════════════
  // GENERAL VIDEO PLATFORMS
  // ════════════════════════════════════════════════════════════════

  {
    id: 'youtube',
    name: 'YouTube',
    group: 'video',
    description: 'The largest video platform on the internet',
    baseUrl: 'https://www.youtube.com/',
    searchMethod: 'url',
    urlTemplate: 'https://www.youtube.com/results?search_query={query}',
    resultSelectors: {
      containerSelector: 'ytd-video-renderer',
      linkSelector: 'a#video-title',
      titleSelector: '#video-title yt-formatted-string',
      thumbnailSelector: 'img.yt-core-image',
      metadataSelectors: {
        channel:   'a.yt-simple-endpoint.ytd-channel-name',
        views:     '#metadata-line span:first-child',
        published: '#metadata-line span:nth-child(2)',
      },
    },
    pagination: { maxPages: 3 },
    browserOptions: {
      blockImages: false, blockStyles: false, blockFonts: true, timeout: 30000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  },

  {
    id: 'vimeo',
    name: 'Vimeo',
    group: 'video',
    description: 'High-quality independent films and creative content',
    baseUrl: 'https://vimeo.com/',
    searchMethod: 'url',
    urlTemplate: 'https://vimeo.com/search?q={query}',
    resultSelectors: {
      containerSelector: 'div[data-clip-id]',
      linkSelector: 'a.iris_video-vital__overlay',
      titleSelector: 'div.iris_video-vital__title',
      thumbnailSelector: 'img.iris_feat-img',
      metadataSelectors: {
        author: 'div.iris_video-vital__author',
        views:  'div.iris_video-vital__plays',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://vimeo.com/search/page:{page}?q={query}',
      maxPages: 5,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 30000 },
  },

  {
    id: 'dailymotion',
    name: 'Dailymotion',
    group: 'video',
    description: 'Global video platform — news, sports, entertainment',
    baseUrl: 'https://www.dailymotion.com/',
    searchMethod: 'url',
    urlTemplate: 'https://www.dailymotion.com/search/{query}',
    resultSelectors: {
      containerSelector: 'div[data-testid="video-card"]',
      linkSelector: 'a[data-testid="video-card-title-link"]',
      titleSelector: 'a[data-testid="video-card-title-link"]',
      thumbnailSelector: 'img[data-testid="video-card-thumbnail"]',
      metadataSelectors: {
        views:   'span[data-testid="video-card-views"]',
        channel: 'a[data-testid="video-card-channel-link"]',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://www.dailymotion.com/search/{query}/page-{page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 30000 },
  },

  {
    id: 'twitch-videos',
    name: 'Twitch Videos',
    group: 'video',
    description: 'VODs, highlights and clips from Twitch streamers',
    baseUrl: 'https://www.twitch.tv/',
    searchMethod: 'url',
    urlTemplate: 'https://www.twitch.tv/search?term={query}',
    resultSelectors: {
      containerSelector: 'article[data-a-target*="video"]',
      linkSelector: 'a[data-a-target*="preview-card-image-link"]',
      titleSelector: 'h3[data-a-target*="preview-card-title"]',
      thumbnailSelector: 'img[alt*="Video"]',
      metadataSelectors: {
        channel: 'a[data-a-target*="preview-card-channel-link"]',
        views:   'span[data-a-target*="preview-card-views"]',
      },
    },
    pagination: { maxPages: 3 },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 30000 },
  },

  {
    id: 'ok-ru',
    name: 'OK.ru',
    group: 'video',
    description: 'Russian social video platform — huge library of movies & shows',
    baseUrl: 'https://ok.ru/',
    searchMethod: 'url',
    urlTemplate: 'https://ok.ru/video/search?q={query}',
    resultSelectors: {
      containerSelector: 'li.video-card_cnt',
      linkSelector: 'a.video-card_t-link',
      titleSelector: 'span.video-card_t',
      thumbnailSelector: 'img.video-card_img-i',
      metadataSelectors: {
        duration: 'span.video-card_duration',
        views:    'span.video-card_v',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://ok.ru/video/search?q={query}&st.page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'bilibili',
    name: 'Bilibili',
    group: 'video',
    description: 'Chinese video platform — anime, dramas, documentaries',
    baseUrl: 'https://www.bilibili.com/',
    searchMethod: 'url',
    urlTemplate: 'https://search.bilibili.com/all?keyword={query}&search_source=5',
    resultSelectors: {
      containerSelector: 'div.bili-video-card',
      linkSelector: 'a.bili-video-card__wrap',
      titleSelector: 'h3.bili-video-card__info--tit',
      thumbnailSelector: 'img.v-img',
      metadataSelectors: {
        views:    'span.bili-video-card__stats--item',
        duration: 'span.bili-video-card__stats__duration',
        author:   'span.bili-video-card__info--author',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://search.bilibili.com/all?keyword={query}&search_source=5&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 30000 },
  },

  // ════════════════════════════════════════════════════════════════
  // MOVIES / TV — EXTRA INDEXERS
  // ════════════════════════════════════════════════════════════════

  {
    id: 'hdtorrents',
    name: 'HDTorrents (mirror)',
    group: 'torrent',
    description: 'HD movie & TV torrent tracker — 720p/1080p/4K encodes',
    baseUrl: 'https://hdts.ru/',
    searchMethod: 'url',
    urlTemplate: 'https://hdts.ru/?search={query}&active=1&options=0',
    resultSelectors: {
      containerSelector: 'table#torrent_table tr.torrent',
      linkSelector: 'td.name a',
      titleSelector: 'td.name a',
      thumbnailSelector: '',
      metadataSelectors: {
        size:     'td.size',
        seeders:  'td.seeders',
        leechers: 'td.leechers',
        category: 'td.cat img',
        date:     'td.date',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://hdts.ru/?search={query}&active=1&options=0&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'cinemageddon',
    name: 'CinemaGeddon',
    group: 'torrent',
    description: 'Cult, classic, foreign & rare films torrent community',
    baseUrl: 'https://cinemageddon.net/',
    searchMethod: 'url',
    urlTemplate: 'https://cinemageddon.net/browse.php?search={query}&cat=0',
    resultSelectors: {
      containerSelector: 'table#torrent_table tr.torrent',
      linkSelector: 'td.name a:nth-child(2)',
      titleSelector: 'td.name a:nth-child(2)',
      thumbnailSelector: '',
      metadataSelectors: {
        size:     'td.size',
        seeders:  'td.seeders',
        year:     'td.year',
        imdb:     'a[href*="imdb.com"]',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://cinemageddon.net/browse.php?search={query}&cat=0&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'showrss',
    name: 'showRSS',
    group: 'torrent',
    description: 'TV show RSS/magnet aggregator — per-show torrent feeds',
    baseUrl: 'https://showrss.info/',
    searchMethod: 'url',
    urlTemplate: 'https://showrss.info/search?q={query}',
    resultSelectors: {
      containerSelector: 'table tr',
      linkSelector: 'td a[href*="magnet"]',
      titleSelector: 'td:first-child',
      thumbnailSelector: '',
      metadataSelectors: {
        episode: 'td:nth-child(2)',
        date:    'td:nth-child(3)',
        quality: 'td:nth-child(4)',
      },
    },
    pagination: { maxPages: 5 },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'tokyotosho',
    name: 'TokyoTosho',
    group: 'torrent',
    description: 'J-drama, J-movie and anime torrent archive',
    baseUrl: 'https://www.tokyotosho.info/',
    searchMethod: 'url',
    urlTemplate: 'https://www.tokyotosho.info/search.php?terms={query}&type=0',
    resultSelectors: {
      containerSelector: 'table.listing tbody tr.category_0, table.listing tbody tr.category_1',
      linkSelector: 'td a.plainlink',
      titleSelector: 'td a.plainlink',
      thumbnailSelector: '',
      metadataSelectors: {
        size:    'td:nth-child(3)',
        seeders: 'td:nth-child(4)',
        date:    'td:nth-child(5)',
        type:    'td:first-child img',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://www.tokyotosho.info/search.php?terms={query}&type=0&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'watch-series-hd',
    name: 'WatchSeriesHD',
    group: 'streaming',
    description: 'Free TV series & movie streaming index — direct embed links',
    baseUrl: 'https://watchseries-hd.ru/',
    searchMethod: 'url',
    urlTemplate: 'https://watchseries-hd.ru/search?q={query}',
    resultSelectors: {
      containerSelector: 'div.item',
      linkSelector: 'a.itemsign',
      titleSelector: 'div.seriestitle',
      thumbnailSelector: 'img',
      metadataSelectors: {
        year:    '.year',
        genre:   '.genre',
        rating:  '.rating',
        quality: '.quality',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://watchseries-hd.ru/search?q={query}&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 25000 },
  },

  // ════════════════════════════════════════════════════════════════
  // ANIME
  // ════════════════════════════════════════════════════════════════

  {
    id: 'nyaa',
    name: 'Nyaa.si',
    group: 'anime',
    description: 'Dominant anime torrent tracker — subs & raws',
    baseUrl: 'https://nyaa.si/',
    searchMethod: 'url',
    urlTemplate: 'https://nyaa.si/?f=0&c=0_0&q={query}',
    resultSelectors: {
      containerSelector: 'tbody tr',
      linkSelector: 'td:nth-child(2) a:not([class*="comments"])',
      titleSelector: 'td:nth-child(2) a:not([class*="comments"])',
      thumbnailSelector: '',
      metadataSelectors: {
        size:     'td:nth-child(4)',
        seeders:  'td:nth-child(6)',
        leechers: 'td:nth-child(7)',
        date:     'td:nth-child(5)',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://nyaa.si/?f=0&c=0_0&q={query}&p={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 20000 },
  },

  {
    id: 'animekaizoku',
    name: 'AnimeKaizoku',
    group: 'anime',
    description: 'Direct download anime — batch series packs',
    baseUrl: 'https://animekaizoku.com/',
    searchMethod: 'form',
    formConfig: {
      inputSelector: 'input[type="search"], input[name="s"]',
      waitForResults: 'article.post',
    },
    resultSelectors: {
      containerSelector: 'article.post',
      linkSelector: 'h2.entry-title a',
      titleSelector: 'h2.entry-title a',
      thumbnailSelector: 'img.wp-post-image',
      metadataSelectors: {
        date: 'time.entry-date',
        tags: '.post-tags a',
      },
    },
    pagination: { maxPages: 3 },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'subsplease',
    name: 'SubsPlease',
    group: 'anime',
    description: 'Weekly simulcast anime releases (SubsPlease group)',
    baseUrl: 'https://subsplease.org/',
    searchMethod: 'url',
    urlTemplate: 'https://subsplease.org/?s={query}',
    resultSelectors: {
      containerSelector: 'div.release',
      linkSelector: 'a.show-release-link',
      titleSelector: 'div.release-title',
      thumbnailSelector: 'img.release-image',
      metadataSelectors: {
        episode: 'div.release-subtitle',
        date:    'span.release-date',
      },
    },
    pagination: { maxPages: 5 },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 20000 },
  },

  // ════════════════════════════════════════════════════════════════
  // ADULT
  // ════════════════════════════════════════════════════════════════

  {
    id: 'xvideos',
    name: 'XVideos',
    group: 'adult',
    description: 'Large adult video platform',
    baseUrl: 'https://www.xvideos.com/',
    searchMethod: 'form',
    formConfig: {
      inputSelector: 'input[name="k"]',
      waitForResults: '.mozaique',
    },
    resultSelectors: {
      containerSelector: '.mozaique .thumb-block',
      linkSelector: '.thumb > a',
      titleSelector: 'p.title a',
      thumbnailSelector: '.thumb img',
      metadataSelectors: {
        duration: '.duration',
        views:    '.metadata .right',
      },
    },
    pagination: { nextButtonSelector: 'a.next-page', maxPages: 10 },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 30000 },
  },

  {
    id: 'pornhub',
    name: 'PornHub',
    group: 'adult',
    description: 'Large adult video platform',
    baseUrl: 'https://www.pornhub.com/',
    searchMethod: 'url',
    urlTemplate: 'https://www.pornhub.com/video/search?search={query}',
    resultSelectors: {
      containerSelector: 'li[data-video-segment-id]',
      linkSelector: 'a.videoPreviewBg',
      titleSelector: 'a.title',
      thumbnailSelector: 'img',
      metadataSelectors: {
        duration: '.duration',
        views:    '.views',
        rating:   '.rating-container .percent',
      },
    },
    pagination: { nextButtonSelector: 'li.page_next a', maxPages: 10 },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 30000 },
  },

  {
    id: 'bitporn',
    name: 'BitPorn',
    group: 'adult',
    description: 'Adult torrent tracker',
    baseUrl: 'https://bitporn.to/',
    searchMethod: 'url',
    urlTemplate: 'https://bitporn.to/browse?search={query}',
    resultSelectors: {
      containerSelector: '.torrent-row',
      linkSelector: 'a.torrent-name',
      titleSelector: 'a.torrent-name',
      thumbnailSelector: '',
      metadataSelectors: {
        size:    '.torrent-size',
        seeders: '.torrent-seeders',
        date:    '.torrent-date',
      },
    },
    pagination: { maxPages: 5 },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'happyfappy',
    name: 'HappyFappy',
    group: 'adult',
    description: 'Adult torrent community',
    baseUrl: 'https://happyfappy.com/',
    searchMethod: 'url',
    urlTemplate: 'https://happyfappy.com/search?q={query}',
    resultSelectors: {
      containerSelector: '.torrent-listing tr',
      linkSelector: 'td.title a',
      titleSelector: 'td.title a',
      thumbnailSelector: '',
      metadataSelectors: {
        size:    'td.size',
        seeders: 'td.seeders',
      },
    },
    pagination: { maxPages: 5 },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'bootyape',
    name: 'BootyTape',
    group: 'adult',
    description: 'Adult content torrent indexer',
    baseUrl: 'https://bootytape.com/',
    searchMethod: 'url',
    urlTemplate: 'https://bootytape.com/search?q={query}',
    resultSelectors: {
      containerSelector: '.video-card',
      linkSelector: 'a.video-link',
      titleSelector: '.video-title',
      thumbnailSelector: 'img.video-thumb',
      metadataSelectors: {
        duration: '.video-duration',
        views:    '.video-views',
      },
    },
    pagination: { maxPages: 5 },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 25000 },
  },

  // ── 5 NEW ADULT / XXX INDEXERS ───────────────────────────────────────────

  {
    id: 'xnxx',
    name: 'XNXX',
    group: 'adult',
    description: 'High-traffic adult video platform — vast free library',
    baseUrl: 'https://www.xnxx.com/',
    searchMethod: 'url',
    urlTemplate: 'https://www.xnxx.com/search/{query}/1',
    resultSelectors: {
      containerSelector: '.thumb-block',
      linkSelector: 'a.thumb-image-container',
      titleSelector: 'p.metadata',
      thumbnailSelector: 'img.thumb',
      metadataSelectors: {
        duration: 'span.metadata',
        views:    'span.metadata-value',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://www.xnxx.com/search/{query}/{page}',
      maxPages: 10,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 30000 },
  },

  {
    id: 'redtube',
    name: 'RedTube',
    group: 'adult',
    description: 'Free adult streaming platform',
    baseUrl: 'https://www.redtube.com/',
    searchMethod: 'url',
    urlTemplate: 'https://www.redtube.com/?search={query}&page=1',
    resultSelectors: {
      containerSelector: 'li.videoBox',
      linkSelector: 'a[data-video-id]',
      titleSelector: 'a.videoTitle',
      thumbnailSelector: 'img.videoBoxImg',
      metadataSelectors: {
        duration: 'span.videoDuration',
        views:    'span.videoViews',
        rating:   'span.videoRating',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://www.redtube.com/?search={query}&page={page}',
      maxPages: 10,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 30000 },
  },

  {
    id: 'empornium',
    name: 'Empornium',
    group: 'adult',
    description: 'Community adult BitTorrent tracker — HD scenes & full movies',
    baseUrl: 'https://www.empornium.is/',
    searchMethod: 'url',
    urlTemplate: 'https://www.empornium.is/torrents.php?searchstr={query}&order_by=s3&order_way=desc',
    resultSelectors: {
      containerSelector: 'table#torrent_table tr.torrent',
      linkSelector: 'td.big_info a.torrentTitle',
      titleSelector: 'td.big_info a.torrentTitle',
      thumbnailSelector: 'td.big_info img',
      metadataSelectors: {
        size:     'td.nobr.torrent_size',
        seeders:  'td.seeding_leeching b:nth-child(1)',
        leechers: 'td.seeding_leeching b:nth-child(2)',
        date:     'td.nobr.torrent_date',
        tags:     'div.torrent_tags a',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://www.empornium.is/torrents.php?searchstr={query}&order_by=s3&order_way=desc&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: true, blockFonts: true, timeout: 30000 },
  },

  {
    id: 'xxxtor',
    name: 'XXXTor',
    group: 'adult',
    description: 'Adult torrent index — movies, scenes, image sets',
    baseUrl: 'https://xxxtor.com/',
    searchMethod: 'url',
    urlTemplate: 'https://xxxtor.com/?s={query}',
    resultSelectors: {
      containerSelector: '.post',
      linkSelector: 'h2.entry-title a',
      titleSelector: 'h2.entry-title a',
      thumbnailSelector: 'img.wp-post-image',
      metadataSelectors: {
        date:  'time.entry-date',
        tags:  '.post-tags a',
        size:  '.post-meta .size',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://xxxtor.com/page/{page}/?s={query}',
      maxPages: 5,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 25000 },
  },

  {
    id: 'adult-empire-torrents',
    name: 'Adult Empire Torrents',
    group: 'adult',
    description: 'Premium adult torrent directory — studio content',
    baseUrl: 'https://www.adult-empire.com/',
    searchMethod: 'url',
    urlTemplate: 'https://www.adult-empire.com/search/?q={query}&f=streaming',
    resultSelectors: {
      containerSelector: 'div.item-wrap',
      linkSelector: 'a.item-link',
      titleSelector: 'div.item-title',
      thumbnailSelector: 'img.item-thumb',
      metadataSelectors: {
        studio:   'span.studio',
        duration: 'span.runtime',
        rating:   'span.rating',
        price:    'span.price',
      },
    },
    pagination: {
      pageUrlTemplate: 'https://www.adult-empire.com/search/?q={query}&f=streaming&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: false, blockStyles: false, blockFonts: true, timeout: 25000 },
  },

  // ════════════════════════════════════════════════════════════════
  // UTILITY / GENERIC
  // ════════════════════════════════════════════════════════════════

  {
    id: 'generic-form',
    name: 'Generic Form Search',
    group: 'utility',
    description: 'Tries a form-based search on any site',
    baseUrl: 'https://example.com/',
    searchMethod: 'form',
    formConfig: {
      inputSelector: 'input[type="search"], input[name="q"], input[name="search"]',
      waitForResults: '.results, #results, .search-results',
    },
    resultSelectors: {
      containerSelector: '.result, .search-result, article',
      linkSelector: 'a',
      titleSelector: 'h2, h3, .title',
      thumbnailSelector: 'img',
    },
    pagination: { nextButtonSelector: '.next, a[rel="next"]', maxPages: 5 },
    browserOptions: { blockImages: true, blockStyles: false, blockFonts: true, timeout: 30000 },
  },

  {
    id: 'generic-url',
    name: 'Generic URL Search',
    group: 'utility',
    description: 'Appends ?q={query} to any URL',
    baseUrl: 'https://example.com/',
    searchMethod: 'url',
    urlTemplate: 'https://example.com/search?q={query}',
    resultSelectors: {
      containerSelector: '.result, .search-result, article',
      linkSelector: 'a',
      titleSelector: 'h2, h3, .title',
      thumbnailSelector: 'img',
    },
    pagination: {
      pageUrlTemplate: 'https://example.com/search?q={query}&page={page}',
      maxPages: 5,
    },
    browserOptions: { blockImages: true, blockStyles: false, blockFonts: true, timeout: 30000 },
  },

  // ════════════════════════════════════════════════════════════════
  // TOP 10 ENGLISH ANIME STREAMING & MEDIA SITES
  // ════════════════════════════════════════════════════════════════

  {
    id: 'anime-eng-crunchyroll',
    name: 'Crunchyroll',
    group: 'anime',
    description: 'Top 10: World\'s largest licensed anime — search simulcast & dubbed catalogue',
    baseUrl: 'https://www.crunchyroll.com',
    searchMethod: 'url',
    urlTemplate: 'https://www.crunchyroll.com/search?q={query}&media_type=anime',
    resultSelectors: {
      containerSelector: 'li.browsebox-item, div[class*="card"]',
      linkSelector:      'a[href*="/watch/"]',
      titleSelector:     'span[class*="title"], h4',
      thumbnailSelector: 'img[class*="thumbnail"], img[src*="images.crunchyroll"]',
    },
    browserOptions: { blockImages: false, blockStyles: true, blockFonts: true, timeout: 30000 },
  },
  {
    id: 'anime-eng-hidive',
    name: 'HIDIVE',
    group: 'anime',
    description: 'Top 10: Licensed English dubs & subs — HIDIVE exclusive titles search',
    baseUrl: 'https://www.hidive.com',
    searchMethod: 'url',
    urlTemplate: 'https://www.hidive.com/search#q={query}',
    resultSelectors: {
      containerSelector: 'div.seriesCard, div[class*="card"]',
      linkSelector:      'a[href*="/tv/"], a[href*="/movies/"]',
      titleSelector:     'h2, div[class*="title"]',
      thumbnailSelector: 'img[class*="poster"], img[class*="thumbnail"]',
    },
    browserOptions: { blockImages: false, blockStyles: true, blockFonts: true, timeout: 30000 },
  },
  {
    id: 'anime-eng-tubi',
    name: 'Tubi TV — Anime',
    group: 'anime',
    description: 'Top 10: 100% free legal anime — real HLS M3U8 streams, no account needed',
    baseUrl: 'https://tubitv.com',
    searchMethod: 'url',
    urlTemplate: 'https://tubitv.com/search/{query}',
    resultSelectors: {
      containerSelector: 'li[class*="VideoGrid"], div[data-testid*="card"]',
      linkSelector:      'a[href*="/video/"]',
      titleSelector:     'p[class*="title"], span[class*="title"]',
      thumbnailSelector: 'img[src*="tubitv"], img[src*="cdn"]',
    },
    browserOptions: { blockImages: false, blockStyles: true, blockFonts: true, timeout: 30000 },
  },
  {
    id: 'anime-eng-plex',
    name: 'Plex — Free Anime',
    group: 'anime',
    description: 'Top 10: Plex free tier with licensed anime — HLS streams no subscription',
    baseUrl: 'https://watch.plex.tv',
    searchMethod: 'url',
    urlTemplate: 'https://watch.plex.tv/search?q={query}&genre=anime',
    resultSelectors: {
      containerSelector: 'div[class*="MetadataPoster"], li[class*="card"]',
      linkSelector:      'a[href*="/watch/"]',
      titleSelector:     'h3, span[class*="title"]',
      thumbnailSelector: 'img[src*="metadata.provider.plex"]',
    },
    browserOptions: { blockImages: false, blockStyles: true, blockFonts: true, timeout: 30000 },
  },
  {
    id: 'anime-eng-9anime',
    name: '9anime',
    group: 'anime',
    description: 'Top 10: Largest English sub/dub catalogue — M3U8 HLS embeds per episode',
    baseUrl: 'https://9anime.to',
    searchMethod: 'url',
    urlTemplate: 'https://9anime.to/filter?keyword={query}&language=sub',
    resultSelectors: {
      containerSelector: 'li.item, div.item',
      linkSelector:      'a[href*="/watch/"]',
      titleSelector:     'p.name, span.name',
      thumbnailSelector: 'img[src*="cdn"]',
    },
    browserOptions: { blockImages: false, blockStyles: true, blockFonts: true, timeout: 30000 },
  },
  {
    id: 'anime-eng-aniwatch',
    name: 'Aniwatch (Zoro.to)',
    group: 'anime',
    description: 'Top 10: Aniwatch sub + dub toggle, top-quality HLS M3U8 per episode',
    baseUrl: 'https://aniwatch.to',
    searchMethod: 'url',
    urlTemplate: 'https://aniwatch.to/search?keyword={query}',
    resultSelectors: {
      containerSelector: 'div.flw-item',
      linkSelector:      'a[href*="/watch"]',
      titleSelector:     'h3.film-name, .dynamic-name',
      thumbnailSelector: 'img.film-poster-img',
    },
    browserOptions: { blockImages: false, blockStyles: true, blockFonts: true, timeout: 30000 },
  },
  {
    id: 'anime-eng-gogoanime',
    name: 'Gogoanime',
    group: 'anime',
    description: 'Top 10: Most-visited free anime site — CDN-hosted M3U8 per episode',
    baseUrl: 'https://gogoanime.tel',
    searchMethod: 'url',
    urlTemplate: 'https://gogoanime.tel/search.html?keyword={query}',
    resultSelectors: {
      containerSelector: 'ul.items li',
      linkSelector:      'a[href*="/category/"]',
      titleSelector:     'p.name a',
      thumbnailSelector: 'div.img img',
    },
    browserOptions: { blockImages: false, blockStyles: true, blockFonts: true, timeout: 30000 },
  },
  {
    id: 'anime-eng-animepahe',
    name: 'AnimePahe',
    group: 'anime',
    description: 'Top 10: High-quality small-size encodes — English sub, Kwik CDN HLS',
    baseUrl: 'https://animepahe.ru',
    searchMethod: 'url',
    urlTemplate: 'https://animepahe.ru/api?m=search&q={query}',
    resultSelectors: {
      containerSelector: 'div.result, .col-12',
      linkSelector:      'a[href*="/anime/"]',
      titleSelector:     '.title, h2',
      thumbnailSelector: 'img[src*="cdn"]',
    },
    browserOptions: { blockImages: false, blockStyles: true, blockFonts: true, timeout: 30000 },
  },
  {
    id: 'anime-eng-bilibili',
    name: 'Bilibili — Global Anime',
    group: 'anime',
    description: 'Top 10: Bilibili global anime section — licensed English-sub simulcasts',
    baseUrl: 'https://www.bilibili.tv',
    searchMethod: 'url',
    urlTemplate: 'https://www.bilibili.tv/en/search?keyword={query}&type=media_bangumi',
    resultSelectors: {
      containerSelector: 'li.bstar-meta__item, div[class*="card"]',
      linkSelector:      'a[href*="/play/"]',
      titleSelector:     'p.bstar-meta__title, span[class*="title"]',
      thumbnailSelector: 'img[class*="cover"]',
    },
    browserOptions: { blockImages: false, blockStyles: true, blockFonts: true, timeout: 30000 },
  },
  {
    id: 'anime-eng-archive',
    name: 'Archive.org — Public Domain Anime',
    group: 'anime',
    description: 'Top 10: Free public domain & Creative Commons anime — direct MP4/M3U8 from metadata API',
    baseUrl: 'https://archive.org',
    searchMethod: 'url',
    urlTemplate: 'https://archive.org/search?query={query}+anime+english&and[]=mediatype%3A%22movies%22&sort=-downloads',
    resultSelectors: {
      containerSelector: 'li.item-ia, div.item-ia',
      linkSelector:      'a[href*="/details/"]',
      titleSelector:     'div.ttl, .item-title',
      thumbnailSelector: 'div.item-image img',
    },
  },
]

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getPresetById(id: string): TaggedPreset | undefined {
  return SEARCH_SOURCE_PRESETS.find(p => p.id === id)
}

export function getAllPresets(): TaggedPreset[] {
  return [...SEARCH_SOURCE_PRESETS]
}

export function getPresetsByGroup(group: TaggedPreset['group']): TaggedPreset[] {
  return SEARCH_SOURCE_PRESETS.filter(p => p.group === group)
}

/** Legacy alias kept for compatibility */
export function getPresetsByCategory(category: 'adult' | 'video' | 'generic'): TaggedPreset[] {
  const map: Record<string, TaggedPreset['group']> = {
    adult:   'adult',
    video:   'video',
    generic: 'utility',
  }
  return getPresetsByGroup(map[category] ?? 'utility')
}
