
var ARTICLES_ROW_KEYS = ['created_at', 'title', 'user', 'tags', 'url'];
var STOCKS_ROW_KEYS   = ['url', 'stock_count'];
var MAX_ROWS = 3000;

// 最新記事取得をするためのページ数と、ページごとの取得件数
var PAGE = 1;
var PER_PAGE = 100;

var BASE_URL = 'https://qiita.com/api/v2/';
var URLS = {
  ITEMS: BASE_URL + 'items'
};

var TOKEN = '';

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
   * Qiitaのランキングの記事を更新する
   */
  updateArticleOfRanking: function() {
    var now = new Date();

    // シートを取得する
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("articles");

    // シートの値を取得する
    var range = sheet.getDataRange();
    var articles = range.getValues();

    // 記事のストック数を取得する
    for (var i = 0; i < articles.length; i++) {
    //for (var i = 0; i < 3; i++) {
      var article = articles[i];
      var url = article[ARTICLES_ROW_KEYS.indexOf('url')];
      var stockCount = this._fetchStockCount(url);
      article.push(stockCount);
    }


    // 期間ごとの記事を抽出する
    var rows = sliceArticlesInTerm(1, articles);

    // ランキング順にソート
    rows = utils.sort2DArrays(rows, articles[0].length - 1);

    // いい感じにmarkdownで表現
    var sheet = ss.getSheets()[1];
    var range = sheet.getRange(1, 1, rows.length, rows[0].length);
    range.setValues(rows);


    /**
     * 期間内に作成された記事のみを抽出する
     * @param {number} days - 範囲としたい日数
     * @param {Array[]} articles - 記事リスト
     * @return {Array[]} 期間内の記事リスト
     */
    function sliceArticlesInTerm(days, articles) {
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
    }



  },

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

    // GoogleAppScriptの最大時間を考慮して、一度に100件ずつストック数を取得する
    var stocks = [];
    for (var i = rowNum; i < rowNum + 100; i++) {
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
    var res = UrlFetchApp.fetch(url).getContentText();
    var stockCount = res
      .match(/js\-stocksCount\"\>\d+/)[0]
      .match(/\d+/)[0];

    return parseInt(stockCount);
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
