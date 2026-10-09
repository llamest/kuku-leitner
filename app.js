(() => {
  "use strict";

  // 1. 設定・問題データ（別ジャンルを追加するときの入口）
  const CONFIG = Object.freeze({
    version: 1, setSize: 10, focusCount: 8,
    intervals: { A: 1, B: 3, C: 7, D: 14, E: 30 }
  });
  const LEVELS = ["A", "B", "C", "D", "E"];
   // 各問題の「答えを含まない読み」と「答えの読み」。
  const KUKU_READINGS = [
    [["いんいちが","いち"], ["いんにが","に"], ["いんさんが","さん"], ["いんしが","し"], ["いんごが","ご"], ["いんろくが","ろく"], ["いんしちが","しち"], ["いんはちが","はち"], ["いんくが","く"]],
    [["にいちが","に"], ["ににんが","し"], ["にさんが","ろく"], ["にしが","はち"], ["にご","じゅう"], ["にろく","じゅうに"], ["にしち","じゅうし"], ["にはち","じゅうろく"], ["にく","じゅうはち"]],
    [["さんいちが","さん"], ["さんにが","ろく"], ["さざんが","く"], ["さんし","じゅうに"], ["さんご","じゅうご"], ["さぶろく","じゅうはち"], ["さんしち","にじゅういち"], ["さんぱ","にじゅうし"], ["さんく","にじゅうしち"]],
    [["しいちが","し"], ["しにが","はち"], ["しさん","じゅうに"], ["しし","じゅうろく"], ["しご","にじゅう"], ["しろく","にじゅうし"], ["ししち","にじゅうはち"], ["しは","さんじゅうに"], ["しく","さんじゅうろく"]],
    [["ごいちが","ご"], ["ごに","じゅう"], ["ごさん","じゅうご"], ["ごし","にじゅう"], ["ごご","にじゅうご"], ["ごろく","さんじゅう"], ["ごしち","さんじゅうご"], ["ごは","しじゅう"], ["ごっく","しじゅうご"]],
    [["ろくいちが","ろく"], ["ろくに","じゅうに"], ["ろくさん","じゅうはち"], ["ろくし","にじゅうし"], ["ろくご","さんじゅう"], ["ろくろく","さんじゅうろく"], ["ろくしち","しじゅうに"], ["ろくは","しじゅうはち"], ["ろっく","ごじゅうし"]],
    [["しちいちが","しち"], ["しちに","じゅうし"], ["しちさん","にじゅういち"], ["しちし","にじゅうはち"], ["しちご","さんじゅうご"], ["しちろく","しじゅうに"], ["しちしち","しじゅうく"], ["しちは","ごじゅうろく"], ["しちく","ろくじゅうさん"]],
    [["はちいちが","はち"], ["はちに","じゅうろく"], ["はちさん","にじゅうし"], ["はちし","さんじゅうに"], ["はちご","しじゅう"], ["はちろく","しじゅうはち"], ["はちしち","ごじゅうろく"], ["はっぱ","ろくじゅうし"], ["はっく","しちじゅうに"]],
    [["くいちが","く"], ["くに","じゅうはち"], ["くさん","にじゅうしち"], ["くし","さんじゅうろく"], ["くご","しじゅうご"], ["くろく","ごじゅうし"], ["くしち","ろくじゅうさん"], ["くは","しちじゅうに"], ["くく","はちじゅういち"]]
  ];

  const QUESTIONS = Array.from({ length: 81 }, (_, i) => {
    const a = Math.floor(i / 9) + 1, b = i % 9 + 1;
    const [readingBefore, answerReading] = KUKU_READINGS[a - 1][b - 1];

    return {
      id: "kuku-" + a + "-" + b,
      a,
      b,
      answer: a * b,
      focus: a >= 6 || b >= 6,
      type: "choice",
      readingBefore,
      readingAfter: readingBefore + answerReading
    };
  });
  const BY_ID = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));
  const PRODUCTS = [...new Set(QUESTIONS.map(q => q.answer))];
  const clone = value => JSON.parse(JSON.stringify(value));

  // ローカル日付。UTCへの変換や24時間のミリ秒加算は使わない。
  function dateKey(date = new Date()) {
    return date.getFullYear() + "-" +
      String(date.getMonth() + 1).padStart(2, "0") + "-" +
      String(date.getDate()).padStart(2, "0");
  }
  function addDays(key, days) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d, 12);
    date.setDate(date.getDate() + days);
    return dateKey(date);
  }
  function validDate(value) {
    if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    return addDays(value, 0) === value;
  }
  function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function choicesFor(q, random = Math.random) {
    const nearby = new Set([
      (q.a - 1) * q.b, (q.a + 1) * q.b,
      q.a * (q.b - 1), q.a * (q.b + 1)
    ]);
    const candidates = shuffle(
      PRODUCTS.filter(n => n !== q.answer), random
    );
    candidates.sort((x, y) =>
      (Math.abs(x - q.answer) - (nearby.has(x) ? 4 : 0)) -
      (Math.abs(y - q.answer) - (nearby.has(y) ? 4 : 0)));
    return shuffle([q.answer, ...candidates.slice(0, 3)], random);
  }

  // 2. 習熟度・履歴。nullが未学習で、Aとは別。
  function newState() {
    return {
      version: CONFIG.version, revision: 0, session: null,
      cards: Object.fromEntries(QUESTIONS.map(q => [q.id, {
        id: q.id, level: null, due: null, lastAnswered: null,
        attempts: 0, correct: 0, incorrect: 0, history: []
      }]))
    };
  }
  function applyAnswer(card, q, selected, today, answeredAt) {
    const before = card.level;
    const regular = before === null || card.due <= today;
    const correct = selected === q.answer;

    if (regular) {
      card.level = correct ?
        (before === null ? "B" :
          LEVELS[Math.min(LEVELS.indexOf(before) + 1, 4)]) : "A";
      card.due = addDays(today, CONFIG.intervals[card.level]);
    }

    card.lastAnswered = today;
    card.attempts++;
    card.correct += Number(correct);
    card.incorrect += Number(!correct);

    const record = {
      selected, correct, regular, before, after: card.level,
      due: card.due, date: today, answeredAt
    };
    card.history.push(record);
    return clone(record);
  }

  // 3. 出題。優先グループをまたいで8:2を強制しない。
  function priority(card, today) {
    if (card.level === null) return 2;
    if (card.due < today) return 0;
    if (card.due === today) return 1;
    return card.lastAnswered === today ? 4 : 3;
  }
  function buildSet(cards, today, random = Math.random) {
    const picked = [];

    for (let tier = 0;
      tier <= 4 && picked.length < CONFIG.setSize;
      tier++) {
      const pool = shuffle(
        QUESTIONS.filter(q => priority(cards[q.id], today) === tier),
        random
      );

      pool.sort((x, y) => {
        const cx = cards[x.id], cy = cards[y.id];
        const byDue = tier <= 1 ? cx.due.localeCompare(cy.due) : 0;
        return byDue ||
          LEVELS.indexOf(cx.level) - LEVELS.indexOf(cy.level);
      });

      const group = [];
      while (pool.length &&
        picked.length + group.length < CONFIG.setSize) {
        const focusSoFar =
          [...picked, ...group].filter(q => q.focus).length;
        const wantFocus = focusSoFar < CONFIG.focusCount;
        const index = pool.findIndex(q => q.focus === wantFocus);
        group.push(pool.splice(index < 0 ? 0 : index, 1)[0]);
      }
      picked.push(...shuffle(group, random));
    }
    return picked;
  }
  function createSession(state, today, random = Math.random) {
    if (state.session &&
      state.session.index < CONFIG.setSize) return state;

    const next = clone(state);
    next.session = {
      started: today, index: 0,
      items: buildSet(next.cards, today, random).map(q => ({
        id: q.id, choices: choicesFor(q, random), result: null
      }))
    };
    return next;
  }
  function answerState(state, selected, today, answeredAt) {
    const session = state.session;
    const item = session?.items[session.index];

    if (!item || item.result ||
      !item.choices.includes(selected)) return state;

    const next = clone(state);
    const target = next.session.items[next.session.index];
    target.result = applyAnswer(
      next.cards[target.id], BY_ID[target.id],
      selected, today, answeredAt
    );
    return next;
  }
  function nextState(state) {
    const s = state.session;
    if (!s || s.index >= CONFIG.setSize ||
      !s.items[s.index].result) return state;

    const next = clone(state);
    next.session.index++;
    return next;
  }

  // 不正な保存データを勝手に初期化して上書きしない。
  function validateState(s) {
    const levelOK = l => l === null || LEVELS.includes(l);
    const countOK = n => Number.isSafeInteger(n) && n >= 0;

    function recordOK(r, q) {
      return r && PRODUCTS.includes(r.selected) &&
        typeof r.correct === "boolean" &&
        r.correct === (r.selected === q.answer) &&
        typeof r.regular === "boolean" && levelOK(r.before) &&
        LEVELS.includes(r.after) &&
        validDate(r.date) && validDate(r.due) &&
        typeof r.answeredAt === "string" &&
        Number.isFinite(Date.parse(r.answeredAt)) &&
        (r.regular ?
          r.after === (r.correct ?
            (r.before === null ? "B" :
              LEVELS[Math.min(LEVELS.indexOf(r.before) + 1, 4)]) :
            "A") &&
          r.due === addDays(r.date, CONFIG.intervals[r.after]) :
          r.before === r.after && r.due > r.date);
    }

    if (!s || s.version !== CONFIG.version ||
      !countOK(s.revision) || !s.cards ||
      Object.keys(s.cards).length !== 81) {
      throw new Error("保存形式を確認できません。");
    }

    for (const q of QUESTIONS) {
      const c = s.cards[q.id];
      if (!c || c.id !== q.id || !levelOK(c.level) ||
        !countOK(c.attempts) || !countOK(c.correct) ||
        !countOK(c.incorrect) ||
        c.attempts !== c.correct + c.incorrect ||
        !Array.isArray(c.history) ||
        c.history.length !== c.attempts ||
        !c.history.every(r => recordOK(r, q)) ||
        c.history.filter(r => r.correct).length !== c.correct ||
        (c.attempts === 0 ?
          c.level !== null || c.due !== null ||
          c.lastAnswered !== null :
          !LEVELS.includes(c.level) || !validDate(c.due) ||
          !validDate(c.lastAnswered))) {
        throw new Error("問題の保存データを確認できません。");
      }

      if (c.attempts) {
        const last = c.history[c.history.length - 1];
        if (last.after !== c.level || last.due !== c.due ||
          last.date !== c.lastAnswered) {
          throw new Error("履歴と現在の状態が一致しません。");
        }
      }
    }

    if (s.session !== null) {
      const t = s.session;
      if (!t || !validDate(t.started) || !Number.isInteger(t.index) ||
        t.index < 0 || t.index > CONFIG.setSize ||
        !Array.isArray(t.items) ||
        t.items.length !== CONFIG.setSize ||
        new Set(t.items.map(i => i.id)).size !== CONFIG.setSize) {
        throw new Error("途中セッションを確認できません。");
      }

      t.items.forEach((item, i) => {
        const q = BY_ID[item.id];
        if (!q || !Array.isArray(item.choices) ||
          item.choices.length !== 4 ||
          new Set(item.choices).size !== 4 ||
          !item.choices.includes(q.answer) ||
          !item.choices.every(n => PRODUCTS.includes(n)) ||
          (i < t.index && !item.result) ||
          (i > t.index && item.result !== null) ||
          (item.result !== null &&
            (!recordOK(item.result, q) ||
              !item.choices.includes(item.result.selected) ||
              JSON.stringify(item.result) !==
              JSON.stringify(s.cards[item.id].history.at(-1))))) {
          throw new Error("回答・選択肢の保存データを確認できません。");
        }
      });
    }
    return s;
  }

  // 純粋関数を公開。テスト用の新規データを作れる。
  const API = {
    CONFIG, QUESTIONS, dateKey, addDays, newState, choicesFor,
    buildSet, applyAnswer, createSession, answerState,
    nextState, validateState
  };
  globalThis.Kuku = Object.freeze(API);
  if (typeof document === "undefined") return;

  // 4. 保存。問題状態とセッションを1つのJSONとして一括更新。
  const app = document.getElementById("app");
  const basePath = location.pathname.replace(/[^/]*$/, "");
  const KEY = "kuku-leitner:" + basePath + ":v1";
  let state, raw, view, busy = false, pending = null, notice = "";

  function load() {
    raw = localStorage.getItem(KEY);
    state = raw === null ?
      newState() : validateState(JSON.parse(raw));
    view = state.session ?
      (state.session.index === CONFIG.setSize ? "result" : "quiz") :
      "home";
  }
  function fatal() {
    app.innerHTML =
      '<section class="card"><h1>記録を開けませんでした</h1>' +
      '<p>保存領域が使えないか、保存データを確認できません。</p>' +
      '<p>ブラウザの保存設定を確認してください。既存の記録は上書きしていません。</p>' +
      '<button onclick="location.reload()">もう一度読み込む</button></section>';
  }
  function commit(candidate, base, targetView) {
    if (localStorage.getItem(KEY) !== base) {
      pending = null;
      load();
      notice = "別の画面で記録が更新されました。最新の続きから進めます。";
      return;
    }

    candidate.revision = state.revision + 1;
    validateState(candidate);
    const encoded = JSON.stringify(candidate);

    try {
      localStorage.setItem(KEY, encoded);
    } catch (e) {
      pending = { candidate, base, targetView };
      notice =
        "保存できませんでした。この画面を閉じずに、保存領域を確認して再保存してください。";
      return;
    }

    raw = encoded;
    state = candidate;
    view = targetView;
    pending = null;
    notice = "";
  }
  async function mutate(transform, targetView) {
    if (busy || pending) return;
    busy = true;
    render();

    const job = () => {
      const latest = localStorage.getItem(KEY);
      if (latest !== raw) {
        load();
        notice = "記録が更新されました。最新の続きから進めます。";
        return;
      }
      const candidate = transform(state);
      if (candidate === state) return;
      commit(candidate, raw, targetView);
    };

    try {
      if (navigator.locks) {
        await navigator.locks.request(KEY, job);
      } else {
        job();
      }
    } catch (e) {
      busy = false;
      fatal();
      return;
    }

    busy = false;
    render();
  }
  async function retry() {
    if (busy || !pending) return;
    busy = true;
    render();

    try {
      const job = () => commit(
        pending.candidate, pending.base, pending.targetView
      );
      if (navigator.locks) {
        await navigator.locks.request(KEY, job);
      } else {
        job();
      }
    } catch (e) {
      busy = false;
      fatal();
      return;
    }

    busy = false;
    render();
  }

  // 5. 画面。回答方式のUIは復習管理から分離。
  const label = level => level === null ? "未学習" : level;
  const niceDate = key => key.slice(5).replace("-", "/");
  const button = (action, text, kind = "primary") =>
    '<button data-action="' + action + '" class="' + kind + '"' +
    (busy || pending ? " disabled" : "") + ">" + text + "</button>";

  function mode(card, today) {
    if (card.level === null) return "はじめて";
    return card.due <= today ? "復習" : "追加練習";
  }

  function homeHTML() {
    const today = dateKey();
    const counts = { U: 0, A: 0, B: 0, C: 0, D: 0, E: 0 };
    let due = 0;

    Object.values(state.cards).forEach(c => {
      counts[c.level ?? "U"]++;
      if (c.level !== null && c.due <= today) due++;
    });

    return '<section class="card">' +
      '<span class="eyebrow">きょうの学習</span>' +
      '<h1>九九を、10問ずつ。</h1>' +
      '<p>6〜9をふくむ九九を多めに練習します。</p>' +
      '<p>きょうの復習 <strong>' + due +
      '問</strong><span class="muted">（期限を過ぎた問題も含む）</span></p>' +
      '<div class="actions">' +
      (state.session ?
        button("resume", "つづきから再開") :
        button("start", "10問スタート")) +
      '</div></section>' +
      '<section class="card"><h2>覚えた九九のようす</h2>' +
      '<div class="distribution" role="img" ' +
      'aria-label="各クラスの問題数は下に表示しています">' +
      Object.entries(counts).map(([k, n]) =>
        '<span class="c-' + k + '" style="width:' +
        n / 81 * 100 + '%"></span>').join("") +
      '</div><div class="stats">' +
      Object.entries(counts).map(([k, n]) =>
        '<div class="stat"><span><i class="dot c-' + k + '"></i>' +
        (k === "U" ? "未学習" : k + "クラス") +
        '</span><b>' + n + '<small> 問</small></b></div>').join("") +
      '</div><p class="muted">' +
      'A：1日 ／ B：3日 ／ C：7日 ／ D：14日 ／ E：30日<br>' +
      '正解すると次のクラスへ。間違えたらAへ。' +
      '予定日前の追加練習ではクラスは変わりません。</p></section>';
  }

  function quizHTML() {
    const s = state.session;
    const item = s.items[s.index];
    const q = BY_ID[item.id];
    const r = item.result;
    const card = state.cards[q.id];

    const answerArea = r ?
      '<div class="feedback' + (r.correct ? "" : " wrong") +
      '" role="status"><b>' +
      (r.correct ? "○ せいかい！" : "もう一度、覚えよう") +
      '</b>' +
      (r.correct ?
        '<p>正解は <strong>' + q.answer + '</strong></p>' :
        '<p>選んだ答え：<strong>' + r.selected +
        '</strong><br>正解：<strong>' + q.answer + '</strong></p>') +
      '<p class="muted">' +
      (r.regular ?
        label(r.before) + ' → ' + r.after +
        ' ／ 次の復習：' + niceDate(r.due) :
        '追加練習：クラスと復習予定日は変わりません。') +
      '</p></div><div class="actions">' +
      button("next", s.index === 9 ? "結果を見る" : "次の問題へ") +
      '</div>' :
      '<div class="choices">' +
      item.choices.map(n =>
        '<button class="choice" data-answer="' + n + '"' +
        (busy || pending ? " disabled" : "") +
        ' aria-label="' + n + '">' + n + '</button>'
      ).join("") +
      '</div><p class="muted">正しい答えを、1つ選んでね。</p>';

    return '<section class="card"><div class="topline"><b>' +
      (s.index + 1) + ' / 10 問</b>' +
      button("pause", "ホームへ", "text-button") +
      '</div><progress max="10" value="' + s.index +
      '" aria-label="学習の進み具合"></progress>' +
      '<span class="tag">' +
      (r ? (r.regular ? "通常の学習" : "追加練習") :
        mode(card, dateKey())) +
      '</span> <span class="muted">' +
      (q.focus ? "重点の九九" : "基本の九九") +
      '</span><h1 class="question">' +
      q.a + ' × ' + q.b + ' = ' + (r ? q.answer : "?") +
      '</h1><p class="reading">' +
      (r ? q.readingAfter : q.readingBefore) +
      '</p><div class="answer-area">' + answerArea +
      '</div></section>';
  }

  function resultHTML() {
    const items = state.session.items;
    const correct = items.filter(i => i.result.correct).length;

    return '<section class="card">' +
      '<span class="eyebrow">10問、おつかれさま</span>' +
      '<h1>今回の結果</h1><div class="metric">' + correct +
      '<small> / 10 問せいかい</small></div><p>正答率 ' +
      correct * 10 + '%</p><div class="actions">' +
      button("finish", "ホームへ戻る", "") +
      button("start", "次の10問へ") +
      '</div></section><section class="card">' +
      '<h2>答えを振り返ろう</h2><ol class="result-list">' +
      items.map(item => {
        const q = BY_ID[item.id], r = item.result;
        return '<li><strong>' + (r.correct ? "○" : "×") +
          ' ' + q.a + ' × ' + q.b + ' = ' + q.answer +
          '</strong>' +
          (!r.correct ?
            '<div>選んだ答え：' + r.selected +
            ' ／ 正解：' + q.answer + '</div>' : "") +
          '<small>' +
          (r.regular ?
            label(r.before) + ' → ' + r.after +
            ' ／ 次の復習：' + niceDate(r.due) :
            '追加練習 ／ ' + r.after +
            'を維持・復習予定日の変更なし') +
          '</small></li>';
      }).join("") +
      '</ol></section>';
  }

  function render() {
    app.innerHTML =
      (notice ?
        '<div class="notice" role="alert">' + notice +
        (pending ?
          '<div class="actions"><button data-action="retry"' +
          (busy ? " disabled" : "") +
          '>再保存する</button></div>' : "") +
        '</div>' : "") +
      (view === "quiz" ? quizHTML() :
        view === "result" ? resultHTML() : homeHTML());
  }

  app.addEventListener("click", event => {
    const target = event.target.closest("button");
    if (!target || target.disabled || busy) return;

    const action = target.dataset.action;
    if (action === "retry") {
      retry();
      return;
    }
    if (pending) return;

    if (target.dataset.answer !== undefined) {
      const selected = Number(target.dataset.answer);
      mutate(
        s => answerState(
          s, selected, dateKey(), new Date().toISOString()
        ),
        "quiz"
      );
    } else if (action === "start") {
      mutate(s => createSession(s, dateKey()), "quiz");
    } else if (action === "next") {
      const destination =
        state.session.index === 9 ? "result" : "quiz";
      mutate(nextState, destination);
    } else if (action === "finish") {
      mutate(s => {
        const next = clone(s);
        next.session = null;
        return next;
      }, "home");
    } else if (action === "pause") {
      view = "home";
      render();
    } else if (action === "resume") {
      view = state.session.index === 10 ? "result" : "quiz";
      render();
    }
  });

  window.addEventListener("storage", event => {
    if ((event.key === KEY || event.key === null) &&
      !busy && !pending) {
      try {
        load();
        notice = "別の画面で更新された記録を読み込みました。";
        render();
      } catch (e) {
        fatal();
      }
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !busy && !pending) {
      try {
        if (localStorage.getItem(KEY) !== raw) load();
        render();
      } catch (e) {
        fatal();
      }
    }
  });

  try {
    load();
    render();
  } catch (e) {
    fatal();
  }
})();