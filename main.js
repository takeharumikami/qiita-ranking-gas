
// var TOKEN = ''
var ARTICLE_ID = 'b6db4bdeb2d3d71fd4e8';

var ARTICLES_ROW_KEYS = ['created_at', 'title', 'user', 'tags', 'url'];
var STOCKS_ROW_KEYS   = ['url', 'stock_count'];
var MAX_ROWS = 3000;
var RANKING_MAX_ROWS = 20;

// 最新記事取得をするためのページ数と、ページごとの取得件数
var PAGE = 1;
var PER_PAGE = 100;

var BASE_URL = 'https://qiita.com/api/v2/';
var URLS = {
  ITEMS: BASE_URL + 'items'
};

function updateArticleOfRanking() {
  main.updateArticleOfRanking();
}

function exportStockCounts() {
  main.exportStockCounts();
}

function exportLatestArticles() {
  main.exportLatestArticles();
}

var main = {

  /**
   * 記事ごとのストック数をシートに出力する。
   * AppScriptの起動最大時間があるため、一定数ずつ更新していく。
   */
  exportStockCounts: function() {
    // シートを取得する
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var sheet = ss.getSheetByName("articles");
    var articles = sheet.getDataRange().getValues();

    var sheet = ss.getSheetByName("stocks");
    var oldStocks = sheet.getDataRange().getValues();

    // 一行目が最新の取得した結果であるため、その続きから取得するためにindexを保持する
    var latestFetchingUrl = oldStocks[0][STOCKS_ROW_KEYS.indexOf('url')];
    var rowNum = 0;
    if (latestFetchingUrl) {
      for (var rowNum = 0; rowNum < articles.length; rowNum++) {
        var a = articles[rowNum];
        if (a[ARTICLES_ROW_KEYS.indexOf('url')] === latestFetchingUrl) {
          rowNum++;
          break;
        }
      }
    }

    // 最後まで取得していた場合は最初から取得する
    if (articles.length <= rowNum) {
      rowNum = 0;
    }

    // GoogleAppScriptの最大時間を考慮して、一度に50件ずつストック数を取得する
    var stocks = [];
    for (var i = rowNum; i < rowNum + 50; i++) {
      var a = articles[i];
      if (!a) {
        break;
      }

      var url = a[ARTICLES_ROW_KEYS.indexOf('url')];
      var stockCount = this._fetchStockCount(url);

      var s = [];
      s[STOCKS_ROW_KEYS.indexOf('url')] = url;
      s[STOCKS_ROW_KEYS.indexOf('stock_count')] = stockCount || 0;
      stocks.push(s);
    }
    stocks.reverse();

    stocks = stocks.concat(oldStocks);
    stocks = stocks.slice(0, MAX_ROWS);

    stocks = utils.alignNumberOf2DArrays(stocks);

    // シートを新たな値で更新する
    var range = sheet.getRange(1, 1, stocks.length, stocks[0].length);
    range.setValues(stocks);
  },


  /**
   * Qiitaの最新記事をシートに出力する
   */
  exportLatestArticles: function() {
    // シートを取得する
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("articles");

    // シートの値を取得する
    var range = sheet.getDataRange();
    var oldRows = range.getValues();

    // デバッグ用
    // range.clear();

    // 最新記事を取得する
    var rows = [];
    for (var i = 0; i < PAGE; i++) {
      var _rows = this._fetchLatestArticles({
        page: i + 1,
        per_page: PER_PAGE,
      });
      rows = rows.concat(_rows);
    }

    rows = rows.concat(oldRows);

    rows = utils.alignNumberOf2DArrays(rows);
    rows = utils.sort2DArrays(rows, ARTICLES_ROW_KEYS.indexOf('created_at'));
    rows = utils.filter2DArrays(rows, ARTICLES_ROW_KEYS.indexOf('url'));

    rows = rows.slice(0, MAX_ROWS);

    // シートを新たな値で更新する
    var range = sheet.getRange(1, 1, rows.length, rows[0].length);
    range.setValues(rows);
  },

  /**
   * Qiitaのランキングの記事を更新する
   */
  updateArticleOfRanking: function() {
    var now = new Date();

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var sheet = ss.getSheetByName("articles");
    var articles = sheet.getDataRange().getValues();

    var sheet = ss.getSheetByName("stocks");
    var stocks = sheet.getDataRange().getValues();

    // ストック数とマージする
    articles = this._mergeArticlesWithStocks(articles, stocks);

    // TODO デイリーとウィークリーを汎用的に
    // 期間ごとの記事リストを取得する
    var dailyArticles = this._sliceArticlesInTerm(now, 2, articles);
    var weeklyArticles = this._sliceArticlesInTerm(now, 7, articles);

    // ランキング順にソート
    dailyArticles = utils.sort2DArrays(dailyArticles, articles[0].length - 1);
    weeklyArticles = utils.sort2DArrays(weeklyArticles, articles[0].length - 1);

    dailyArticles = dailyArticles.slice(0, RANKING_MAX_ROWS);
    weeklyArticles = weeklyArticles.slice(0, RANKING_MAX_ROWS);

    // シートに結果を出力(テストのため)
    var sheet = ss.getSheetByName("ranking_daily");
    var range = sheet.getRange(1, 1, dailyArticles.length, dailyArticles[0].length);
    range.setValues(dailyArticles);

    var sheet = ss.getSheetByName("ranking_weekly");
    var range = sheet.getRange(1, 1, weeklyArticles.length, weeklyArticles[0].length);
    range.setValues(weeklyArticles);

    // QiitaAPIで記事を更新する
    Logger.log(dailyArticles);
    this._updateQiitaArticle(dailyArticles, weeklyArticles);

  },


  /**
   * 最新記事を取得する。
   * @param {Object} [option]
   * @param {number} [option.page] - 取得したいページ数
   * @param {number} [option.per_page] - 一度に取得するページごとの件数
   * @return {Array[]} 記事リスト
   */
  _fetchLatestArticles: function(option) {
    var page = option.page || 1;
    var per_page = option.per_page || 100;

    var url = URLS.ITEMS + '?page=' + page + '&per_page=' + per_page;

    var res = UrlFetchApp.fetch(url).getContentText();
    res = JSON.parse('{"key":' + res + '}').key;

    var articles = [];
    for (var i = 0; i < res.length; i++) {
      var r = res[i];
      var article = articles[i] = [];

      for (var j = 0; j < ARTICLES_ROW_KEYS.length; j++) {
        var key = ARTICLES_ROW_KEYS[j];
        var value = r[key];
        article.push(parse(key, value));
      }
    }

    return articles;

    /**
     * Qiita Apiで取得した記事を保持したい内容に変換する
     * @param {string} key
     * @param {string} value
     * @return {string} 変換後の値
     */
    function parse(key, value) {
      if (key === 'user') {
        return value.id;
      }

      if (key === 'created_at') {
        return value.split('+')[0];
      }

      if (key === 'tags') {
        var tags = [];
        for (var i = 0; i < value.length; i++) {
          tags.push(value[i].name);
        }
        return tags.join(',');
      }

      return value || '';
    }

  },

  /**
   * Qiitaの記事からストック数を取得する
   * @param {string} url - 記事のURL
   * @return {number} ストック数
   */
  _fetchStockCount: function(url) {
    var res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true
    }).getContentText();

    // 記事が削除されている場合
    if (!res.match(/js\-stocksCount\"\>\d+/)) {
      return 0;
    }

    var stockCount = res
      .match(/js\-stocksCount\"\>\d+/)[0]
      .match(/\d+/)[0];

    return parseInt(stockCount);
  },

  /**
   * 期間内に作成された記事のみを抽出する
   * @param {Date} now - 現在時刻のDateオブジェクト
   * @param {number} days - 範囲としたい日数
   * @param {Array[]} articles - 記事リスト
   * @return {Array[]} 期間内の記事リスト
   */
  _sliceArticlesInTerm: function(now, days, articles) {
    var term = new Date(now.getTime());
    term.setDate(term.getDate() - days);

    for (var i = 0; i < articles.length; i++) {
      var article = articles[i];
      var created_at = article[ARTICLES_ROW_KEYS.indexOf('created_at')];

      // Google App Scriptのフォーマットに統一する
      var date = new Date(created_at + '.508Z');
      date.setHours(date.getHours() - 9);

      if (date.getTime() < term.getTime()) {
        break;
      }
    }

    return articles.slice(0, i);
  },

  /**
   * 記事にストック数をマージする
   * @param {Array[]} articles - 記事リスト
   * @param {Array[]} stocks - 記事に対するストック数のリスト
   * @return {Array[]} ストック数が加えられた記事リスト
   */
  _mergeArticlesWithStocks: function(articles, stocks) {
    // ストックとURLのマップに変換する
    var _stocks = {};
    for (var i = 0; i < stocks.length; i++) {
      var s = stocks[i];

      var url = s[STOCKS_ROW_KEYS.indexOf('url')];
      var stockCount = s[STOCKS_ROW_KEYS.indexOf('stock_count')];
      _stocks[url] = parseInt(stockCount);
    }

    for (var i = 0; i < articles.length; i++) {
      var a = articles[i];

      var url = a[ARTICLES_ROW_KEYS.indexOf('url')];
      a.push(_stocks[url] || 0);
    }

    return articles;
  },

  /**
   * Qiitaの記事を更新する
   */
  _updateQiitaArticle: function(dailyArticles, weeklyArticles) {
    var url = URLS.ITEMS + '/' + ARTICLE_ID;

    var title = '【毎日自動更新】Qiitaのデイリーストックランキング！ウィークリーもあるよ';
    //var title = '【すぐ削除】QiitaAPIのテストです';

    var body = '# この記事について\n\n';
    body += 'この記事は「毎日自動更新」されます。(毎朝6時)ぜひストックやブクマをして定期的にみてみてくださいね。\n\n';
    body += 'Twitterで更新をチェックしたい場合はこちら\n';
    body += '[Twitter](https://twitter.com/takeharumikami)\n\n';

    body += '# デイリーストックランキング\n\n';

    var RANK = '#### ${rank}位';
    var TITLE = ' [${title}](${url})';
    var STOCK_COUNT = '(${stockCount}ストック)\n';
    var USER = 'by ${user}\n';
    // TODO 汎用的に
    for (var i = 0; i < 10; i++) {
      var a = dailyArticles[i];
      body += RANK.replace(/\$\{rank\}/, (i + 1))
      body += TITLE.replace(/\$\{title\}/, a[ARTICLES_ROW_KEYS.indexOf('title')])
        .replace(/\$\{url\}/, a[ARTICLES_ROW_KEYS.indexOf('url')]);
      body += STOCK_COUNT.replace(/\$\{stockCount\}/, a[a.length - 1]);
      body += USER.replace(/\$\{user\}/, a[ARTICLES_ROW_KEYS.indexOf('user')]);
    }

    body += '# ウィークリーストックランキング\n\n';

    for (var i = 0; i < 20; i++) {
      var a = weeklyArticles[i];
      body += RANK.replace(/\$\{rank\}/, (i + 1))
      body += TITLE.replace(/\$\{title\}/, a[ARTICLES_ROW_KEYS.indexOf('title')])
        .replace(/\$\{url\}/, a[ARTICLES_ROW_KEYS.indexOf('url')]);
      body += STOCK_COUNT.replace(/\$\{stockCount\}/, a[a.length - 1]);
    }


    body += '\n\n※ バグがあればTwiiterでいただけると助かります。(コメントがたまると、このページ自体が重くなるので。。)\n';
    body += 'Twitter: [@takeharumikami](https://twitter.com/takeharumikami)\n\n';


    var payload =
    {
      'title': title,
      'body': body,
      'tags': [
        {
          'name': 'Qiita',
          'versions': [
            '0.0.1'
          ]
        }
      ],
      //'private': true,
    };

    var options = {
      'contentType': 'application/json',
      'method' : 'PATCH',
      'headers': {
        'Authorization': 'Bearer ' + TOKEN
      },
      'payload' : JSON.stringify(payload)
    };

   UrlFetchApp.fetch(url, options);
  }
};

var utils = {

  /**
   * ２次元配列を指定されたカラムの値から降順でソートする。
   * @param {sheet} arrays - 対象となる２次元配列
   * @param {number} columnNum - 列数
   */
  sort2DArrays: function(arrays, columnNum) {
    arrays.sort(function(a, b) {
      if(a[columnNum] < b[columnNum]) {
        return 1;
      }
      if(a[columnNum] > b[columnNum]) {
        return -1;
      }
      return 0;
    });
    return arrays;
  },

  /**
   * ２次元配列から、指定されたカラムの値が重複していない二次元配列を抽出する。
   * @param {sheet} arrays - 対象となる２次元配列
   * @param {number} columnNum - 列数
   */
  filter2DArrays: function(arrays, columnNum) {
    var _arrays = [];
    var keys = [];
    for (var i = 0; i < arrays.length; i++) {
      var array = arrays[i];
      var key = array[columnNum];
      if (keys.indexOf(key) >= 0) {
        continue;
      }
      _arrays.push(array);
      keys.push(key);
    }

    return _arrays;
  },

  /**
   * ２次元配列の要素数を最大に揃える
   * @param {sheet} arrays - 対象となる２次元配列
   */
  alignNumberOf2DArrays: function(arrays) {
    var maxLength = 0;
    for (var i = 0; i < arrays.length; i++) {
      var array = arrays[i];
      maxLength = maxLength < array.length ? array.length : maxLength;
    }

    for (var i = 0; i < arrays.length; i++) {
      var array = arrays[i];
      for (var j = 0; j < maxLength; j++) {
        array[j] = array[j] || '';
      }
    }
    return arrays;
  }
};

var is = {
  string: function(str) {
    return typeof str === 'string';
  },
  array: function(array) {
    return Array.isArray(array);
  },
};
