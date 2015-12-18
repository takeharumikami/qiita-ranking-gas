
var ROW_KEYS = ['created_at', 'title', 'user', 'tags', 'url'];
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

function exportLatestArticles() {
  main.exportLatestArticles();
}

var main = {

  /**
   * Qiitaのランキングの記事を更新する
   */
  updateArticleOfRanking: function() {

  },


  /**
   * Qiitaの最新記事をシートに出力する
   */
  exportLatestArticles: function() {
    // シートを取得する
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0];

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
    rows = utils.sort2DArrays(rows, ROW_KEYS.indexOf('created_at'));
    rows = utils.filter2DArrays(rows, ROW_KEYS.indexOf('url'));

    rows = rows.slice(0, MAX_ROWS);

    // シートを新たな値で更新する
    var range = sheet.getRange(1, 1, rows.length, rows[0].length);
    range.setValues(rows);
  },

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

      for (var j = 0; j < ROW_KEYS.length; j++) {
        var key = ROW_KEYS[j];
        var value = r[key];
        article.push(parse(key, value));
      }
    }

    return articles;

    function parse(key, value) {
      if (key === 'user') {
        return value.id;
      }

      if (key === 'tags') {
        var tags = [];
        for (var i = 0; i < value.length; i++) {
          tags.push(value[i].name);
        }
        return tags.join(',');
      }

      return value;
    }

  }

};

var utils = {

  /**
   * ２次元配列を指定されたカラムの値から降順でソートする。
   * @param {Sheet} arrays - 対象となる２次元配列
   * @param {Number} columnNum - 列数
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
   * @param {Sheet} arrays - 対象となる２次元配列
   * @param {Number} columnNum - 列数
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
   * @param {Sheet} arrays - 対象となる２次元配列
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
