
// TODO Qiita APIのタグ一覧に切り替え
var TAGS = [
  'Android',
  'CSS',
  'C++',
  'Git',
  'GitHub',
  'HTML',
  'HTML5',
  'iOs',
  'iPhone',
  'Java',
  'JavaScript',
  'jQuery',
  'Linux',
  'Mac',
  'Objective-C',
  'PHP',
  'Python',
  'Qiita',
  'Ruby',
  'Vim',
];

var ROW_KEYS = ['published', 'title', 'author', 'url'];
var MAX_ROWS = 2000;

var TAG_URL = 'http://qiita.com/tags/${TAG_ID}/feed';
var ATOM = XmlService.getNamespace('http://www.w3.org/2005/Atom');

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

    range.clear();

    // タグごとのURLリストの生成
    var urls = [];
    for (var i = 0; i < TAGS.length; i++) {
      var url = TAG_URL.replace(/\$\{TAG_ID\}/, TAGS[i]);
      urls.push(url);
    }

    var rows = parser.execute(urls);
    rows = rows.concat(oldRows);

    rows = utils.alignNumberOf2DArrays(rows);
    rows = utils.sort2DArrays(rows, ROW_KEYS.indexOf('published'));
    rows = utils.filter2DArrays(rows, ROW_KEYS.indexOf('url'));

    rows = rows.slice(0, MAX_ROWS);

    // シートを新たな値で更新する
    var range = sheet.getRange(1, 1, rows.length, rows[0].length);
    range.setValues(rows);
  }

};

var parser = {

  execute: function(urls) {
    urls = is.string(urls) ? [urls] : urls;

    var rows = [];
    for (var i = 0; i < urls.length; i++) {
      var xml = UrlFetchApp.fetch(urls[i]).getContentText();
      var doc = XmlService.parse(xml);
      var root = doc.getRootElement();
      var entries = doc.getRootElement().getChildren('entry', ATOM);

      for (var j = 0; j < entries.length; j++) {
        var values = {
          url      : entries[j].getChild('url', ATOM).getText(),
          title    : entries[j].getChild('title', ATOM).getText(),
          published: entries[j].getChild('published', ATOM).getText(),
        };
        values.author = values.url.split('/')[3];

        var row = [];
        for (var k = 0; k < ROW_KEYS.length; k++) {
          var key = ROW_KEYS[k];
          row.push(values[key]);
        }
        rows.push(row)
      }
    }

    return rows;
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
