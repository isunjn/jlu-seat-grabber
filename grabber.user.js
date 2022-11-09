// ==UserScript==
// @name        JLU Seat Grabber
// @namespace   jlu-scripting
// @match       http://libzwyy.jlu.edu.cn/*
// @version     0.1
// @description 吉林大学鼎新图书馆自动抢座
// @author      anonymous
// @run-at      document-end
// @grant       none
// ==/UserScript==

/* ---------------- configuration ----------------- */

const RESV_URL = 'http://libzwyy.jlu.edu.cn/ic-web/reserve';

const tomorrow = fmtDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
const configMemo = localStorage.getItem('GRABBER_CONFIG');
const config = configMemo ? JSON.parse(configMemo) : {
    seats: '',
    date: tomorrow,
    beginTime: '07:00',
    endTime: '22:00',
    mode: 'timing', // 'timing' | 'polling'
    aheadTime: 30,
    targetTime: '21:00',
    hit: 5,
    interval: 100,
    timeout: 2,
};
config.date = tomorrow;

/* ---------------- init grabber ----------------- */

const html = `
<div id="grabber">
<!-- bar section -->
<div id="bar" class="flex-container">
  <div id="title">JLU Seat Grabber v0.1</div>
  <div id="meta-btns-wrapper" class="flex-container">
    <div class="meta-btn" id="meta-btn-help">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-help-circle"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    </div>
    <div class="meta-btn" id="meta-btn-drag">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-move"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
    </div>
  </div>
</div>

<!-- seats section -->
<div id="seats-wrapper" class="wrapper">
  <div class="flex-container flex-item">
    <label for="i-seats"> 座位：</label>
    <textarea class="flex-item" id="i-seats" rows="1">${config.seats}</textarea>
  </div>
</div>

<!-- datetime section -->
<div id="datetime-wrapper" class="wrapper">
  <div class="flex-container flex-item">
    <label for="i-date">日期：</label>
    <input class="flex-item" type="date" id="i-date" value="${config.date}" />
  </div>
  <div class="flex-container flex-item">
    <label class="flex-item" for="i-beginTime">开始时间：</label>
    <input
      class="flex-item"
      type="time"
      id="i-beginTime"
      min="06:30"
      max="22:00"
      step="600"
      value="${config.beginTime}"
    />
  </div>
  <div class="flex-container flex-item">
    <label class="flex-item" for="i-endTime">结束时间：</label>
    <input
      class="flex-item"
      type="time"
      id="i-endTime"
      min="06:30"
      max="22:00"
      step="600"
      value="${config.endTime}" />
  </div>
</div>

<!-- mode section -->
<div id="mode-wrapper" class="wrapper">
  <div class="flex-container flex-item">
    <label class="flex-item" for="i-mode"> 模式： </label>
    <select class="flex-item" id="i-mode">
      <option value="timing" ${config.mode == 'timing' ? 'selected' : ''}>定时抢座</option>
      <option value="polling" ${config.mode == 'polling' ? 'selected' : ''}>轮询捡漏</option>
    </select>
  </div>
  <div class="flex-container flex-item">
    <label class="flex-item" for="i-aheadTime">提前(s)：</label>
    <input class="flex-item" type="number" id="i-aheadTime" value="${config.aheadTime}" ${config.mode != 'timing' ? 'disabled' : ''} />
  </div>
  <div class="flex-container flex-item">
    <label class="flex-item" for="i-targetTime">定时目标：</label>
    <input
      class="flex-item"
      type="time"
      id="i-targetTime"
      value="${config.targetTime}"
      ${config.mode != 'timing' ? 'disabled' : ''}
    />
  </div>
</div>

<!-- control section -->
<div id="control-wrapper" class="wrapper">
  <div class="flex-container flex-item">
    <label class="flex-item" for="i-hit"> 连击： </label>
    <input class="flex-item" type="number" id="i-hit" value="${config.hit}" min="1" step="1" />
  </div>
  <div class="flex-container flex-item">
    <label class="flex-item" for="i-interval"> 间隔(ms)： </label>
    <input class="flex-item" type="number" id="i-interval" value="${config.interval}" min="1" step="1" />
  </div>
  <div class="flex-container flex-item">
    <label class="flex-item" for="i-timeout"> 超时(min)： </label>
    <input class="flex-item" type="number" id="i-timeout" value="${config.timeout}" min="1" step="1" />
  </div>
</div>

<!-- button section -->
<div id="btn-wrapper" class="wrapper">
  <button id="operate-btn">开始抢座</button>
</div>

<!-- indicator section -->
<div id="indicator"></div>

<!-- help section -->
<div id="manual" class="hidden">
  <p>使用说明/注意事项：</p>
  <p>- 鼎新图书馆自动抢座脚本</p>
</div>
</div>
`;

const css = `
  #grabber {
    --bg-color: #f7f7f7;
    --fg-color: #565656;
    --disable-color: #00000063;
    --btn-color: #e4e4e4b0;
    --pending-color: #a974ef;
    --success-color: #7ac19e;
    --fail-color: #e3676b;
    --border-radius: 4px;
  }
  #grabber * {
    font-size: 10px;
  }
  #grabber {
    box-sizing: border-box;
    margin: 0;
    width: 600px;
    position: fixed;
    top: 1em;
    left: 1em;
    z-index: 9999;
    background-color: var(--bg-color);
    color: var(--fg-color);
    padding: 1em;
    border-radius: var(--border-radius);
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    box-shadow: var(--btn-color) 0px 0px 0px 3px;
  }
  #grabber #bar {
    margin-bottom: 1em;
    user-select: none;
  }
  #grabber .meta-btn {
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 12px;
    font-weight: bold;
    height: 2em;
    width: 2em;
    border: none;
    border-radius: var(--border-radius);
    background-color: var(--bg-color);
    color: var(--fg-color);
    margin-left: 1em;
  }
  #grabber #meta-btn-help {
    cursor: pointer;
  }
  #grabber #meta-btn-drag {
    cursor: move;
  }
  #grabber .flex-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  #grabber .flex-item {
    flex: 1;
    white-space: nowrap;
  }
  #grabber .flex-reset {
    flex-grow: 0;
  }
  #grabber input[type="number"] {
    width: 5em;
  }
  #grabber input,
  #grabber textarea,
  #grabber select,
  #grabber #operate-btn {
    border: none;
    color: var(--fg-color);
    border-radius: var(--border-radius);
    background-color: var(--btn-color);
    padding: 0.5em 1em;
    outline: none;
  }
  #grabber input:disabled,
  #grabber textarea:disabled,
  #grabber select:disabled {
    color: var(--disable-color);
    cursor: not-allowed;
  }
  #grabber textarea {
    resize: vertical;
  }
  #grabber #operate-btn {
    width: 100%;
    padding: 0.75em;
    border: 3px solid var(--btn-color);
    background-color: var(--bg-color);
    color: var(--fg-color);
    cursor: pointer;
    font-weight: bold;
  }
  #grabber .wrapper {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 2em;
  }
  #grabber #indicator {
    min-height: 3em;
    display: flex;
    align-items: center;
    padding: 0 1.25em;
    color: var(--bg-color);
    border-radius: var(--border-radius);
    margin-top: 0.75em;
    background-image: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 8px,
      var(--btn-color) 8px,
      var(--btn-color) 10px
    );
  }
  #grabber #indicator.waiting,
  #grabber #indicator.grabing {
    background-color: var(--pending-color);
    background-image: none;
  }
  #grabber #indicator.success {
    background-color: var(--success-color);
    background-image: none;
  }
  #grabber #indicator.fail {
    background-color: var(--fail-color);
    background-image: none;
  }
  #grabber #indicator.erroring {
    border: 2px dashed var(--fail-color);
    background-image: none;
  }
  #grabber #indicator.erroring ul::marker {
    color: var(--fail-color);
  }
  #grabber #indicator.erroring li {
    color: var(--fail-color);
    margin: 1em 0;
  }
  #grabber #manual {
    margin: 1em 0;
  }
  #grabber #manual.hidden {
    display: none;
  }
`;

const style = document.createElement('style');
style.innerHTML = css;
document.head.appendChild(style);
const container = document.createElement('div');
container.innerHTML = html;
document.body.appendChild(container);

/* ---------------------- DOM elements ref ---------------------- */

const select = (id) => container.querySelector(`#${id}`);
const grabber = select('grabber');
const allConfigElements = ['i-seats', 'i-date', 'i-beginTime', 'i-endTime', 'i-mode', 'i-aheadTime', 'i-targetTime', 'i-hit', 'i-interval', 'i-timeout'].map(select);
const timingConfigElements = ['i-aheadTime', 'i-targetTime'].map(select);
const [elHit, elInterval, elTimeout] = ['i-hit', 'i-interval', 'i-timeout'].map(select);
const [elIndicator, elManual] = ['indicator', 'manual'].map(select);
const [btnOperate, btnHelp, btnDrag] = ['operate-btn', 'meta-btn-help', 'meta-btn-drag'].map(select);

/* ------------------- global sharing state ------------------ */

const state = {
    status: 'idle', // 'idle' | 'erroring' | 'waiting' | 'grabing' | 'success' | 'fail'
    errors: [],
    requestCount: 0,
    countDown: 0,
    successData: null,
    failMsg: null,
    countElement: null,
    grabingTimer: null,
    checkingTimer: null,
    giveupTimer: null,
    user: null,
    targetSeats: [],
};

const payload = {
    'sysKind': 8,
    'appAccNo': '',
    'memberKind': 1,
    'resvMember': [''],
    'resvBeginTime': '',
    'resvEndTime': '',
    'testName': '',
    'captcha': '',
    'resvProperty': 0,
    'resvDev': [0],
    'memo': ''
};

const option = {
    'method': 'POST',
    'headers': {
        'Content-Type': 'application/json;charset=UTF-8',
        'lan': 1,
        'token': '',
    },
    'body': '',
};

/* ------------------- event handle -------------------- */

grabber.addEventListener('change', handleInputChange);
btnOperate.addEventListener('click', handleOperate);
btnHelp.addEventListener('click', handleToggleHelp);
makeGrabberDragable();

function handleInputChange(evt) {
    const val = evt.target.value;
    switch (evt.target.id) {
        case 'i-seats': config.seats = val; break;
        case 'i-date': config.date = val; break;
        case 'i-beginTime': config.beginTime = val; break;
        case 'i-endTime': config.endTime = val; break;
        case 'i-mode': {
            config.mode = val;
            timingConfigElements.forEach(el => el.disabled = val == 'timing' ? false : true);
            const [hit, interval, timeout] = val == 'timing' ? [5, 100, 2] : [1, 1000, 30];
            config.hit = hit;
            config.interval = interval;
            config.timeout = timeout;
            elHit.value = hit;
            elInterval.value = interval;
            elTimeout.value = timeout;
            break;
        }
        case 'i-aheadTime': config.aheadTime = parseFloat(val); break;
        case 'i-targetTime': config.targetTime = val; break;
        case 'i-hit': config.hit = parseInt(val); break;
        case 'i-interval': config.interval = parseFloat(val); break;
        case 'i-timeout': config.timeout = parseFloat(val); break;
        default: throw 'unreachable';
    }
    localStorage.setItem('GRABBER_CONFIG', JSON.stringify(config));
}

function handleOperate() {
    console.log(config);
    if (validate()) startRuning();
}

function handleCancel() {
    clearInterval(state.grabingTimer);
    clearTimeout(state.checkingTimer);
    clearTimeout(state.giveupTimer);
    state.status = 'idle';
    state.errors = [];
    state.requestCount = 0;
    state.countDown = 0;
    state.countElement = null;
    state.successData = null;
    state.failMsg = null;
    state.grabingTimer = null;
    state.checkingTimer = null;
    state.giveupTimer = null;
    state.user = null;
    state.targetSeats = [];
    updateUI();
}

function handleToggleHelp() {
    elManual.classList.toggle('hidden');
}

function makeGrabberDragable() {
    btnDrag.addEventListener('mousedown', handleDragStart);
    let lastPosX = 0, lastPosY = 0;
    function handleDragStart(evt) {
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', handleDragEnd);
    }
    function handleDrag(evt) {
        const deltaX = evt.clientX - lastPosX;
        const deltaY = evt.clientY - lastPosY;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
        grabber.style.left = (grabber.offsetLeft + deltaX) + 'px';
        grabber.style.top = (grabber.offsetTop + deltaY) + 'px';
    }
    function handleDragEnd() {
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
    }
}

/* ---------------------- UI update ------------------ */

function updateUI() {
    elIndicator.className = state.status;

    const operating = state.status != 'idle' && state.status != 'erroring';
    if (operating) {
        allConfigElements.forEach(el => el.disabled = true);
        btnOperate.innerText = '取消';
        btnOperate.removeEventListener('click', handleOperate);
        btnOperate.addEventListener('click', handleCancel);
    } else {
        allConfigElements.forEach(el => el.disabled = false);
        if (config.mode != 'timing') timingConfigElements.forEach(el => el.disabled = true);
        btnOperate.innerText = '开始抢座';
        btnOperate.removeEventListener('click', handleCancel);
        btnOperate.addEventListener('click', handleOperate);
    }

    switch (state.status) {
        case 'idle': {
            elIndicator.innerHTML = ``;
            break;
        }
        case 'erroring': {
            elIndicator.innerHTML = `<ul>${state.errors.map(str => '<li>' + str + '</li>').join('')}</ul>`;
            break;
        }
        case 'waiting': {
            elIndicator.innerHTML = `准备抢座...&nbsp;&nbsp;&nbsp;&nbsp;倒计时&nbsp;&nbsp;<span id='count'>${state.countDown}</span>&nbsp;&nbsp;s`;
            state.countElement = elIndicator.querySelector('#count');
            break;
        }
        case 'grabing': {
            elIndicator.innerHTML = `正在抢座...&nbsp;&nbsp;&nbsp;&nbsp;已请求&nbsp;&nbsp;<span id='count'>${state.requestCount}</span>&nbsp;&nbsp;次`;
            state.countElement = elIndicator.querySelector('#count');
            break;
        }
        case 'success': {
            const { resvDevInfoList, resvDate, resvBeginTime, resvEndTime, resvName, logonName } = state.successData;
            const seatName = resvDevInfoList[0].devName;
            const date = `${String(resvDate).slice(4, 6)}-${String(resvDate).slice(6, 8)}`;
            const beginTime = fmtTime(new Date(resvBeginTime));
            const endTime = fmtTime(new Date(resvEndTime));
            elIndicator.innerHTML = `${seatName}&nbsp;&nbsp;&nbsp;&nbsp;${date}&nbsp;&nbsp;&nbsp;&nbsp;${beginTime}-${endTime}&nbsp;&nbsp;&nbsp;&nbsp;${resvName}&nbsp;&nbsp;&nbsp;&nbsp;${logonName}&nbsp;&nbsp;&nbsp;&nbsp;累计发送请求&nbsp;&nbsp;${state.requestCount}&nbsp;&nbsp;次`;
            break;
        }
        case 'fail': {
            elIndicator.innerHTML = `抢座失败&nbsp;&nbsp;&nbsp;&nbsp;${state.failMsg}&nbsp;&nbsp;&nbsp;&nbsp;累积发送请求&nbsp;&nbsp;${state.requestCount}&nbsp;&nbsp;次`;
            break;
        }
        default: throw 'unreachable';
    }
}

function updateCountDownUI() {
    state.countElement.innerText = state.countDown;
}

function updateResquestCountUI() {
    state.countElement.innerText = state.requestCount;
}

/* ---------------------- parse and validate ---------------------- */

function validate() {
    const errors = [];

    const login = JSON.parse(sessionStorage.getItem('isLogin') || 'false');
    if (!login) {
        errors.push('用户未登录');
    } else {
        state.user = JSON.parse(sessionStorage.getItem('userInfo'));
    }

    const result = parseTargetSeats();
    switch (result.type) {
        case 'Ok': state.targetSeats = result.value; break;
        case 'Err': errors.push(...result.error); break;
    }

    for (const [k, v] of Object.entries(config)) {
        if (v !== 0 && !v && k != 'seats') errors.push(`配置项 ${k} 不能为空`);
    }

    if (config.interval && config.hit && state.targetSeats.length) {
        const qps = Math.floor((1000 / config.interval) * config.hit * state.targetSeats.length);
        if (qps > 200) errors.push(`请求频率最好别超过 200 , 当前为 ${qps}`);
    }

    state.errors = errors;
    if (errors.length > 0) {
        state.status = 'erroring';
        updateUI();
        return false;
    }
    return true;
}

function parseTargetSeats() {
    const BASE_MAP = {
        '2B': 100652811,
        '3A': 100653165,
        '3B': 100653289,
        '4A': 100653477,
        '4B': 100653649,
        '5A': 100653893,
        '5B': 100654024,
    };
    const RE_ONE_SEAT = /^(2B|3A|3B|4A|4B|5A|5B)(\d{3})$/i;
    const RE_SEAT_SEQUENCE = /^(2B|3A|3B|4A|4B|5A|5B)(\d{3})-(\d{3})$/i;

    const seats = [];
    const errors = [];
    for (const str of (config.seats.match(/\S+/g) || [])) {
        let match;
        if (match = str.match(RE_ONE_SEAT)) {
            const [, space, num] = match;
            seats.push(BASE_MAP[space.toUpperCase()] + parseInt(num));
        } else if (match = str.match(RE_SEAT_SEQUENCE)) {
            const [, space, start, end] = match;
            const base = BASE_MAP[space.toUpperCase()];
            for (let num = parseInt(start); num <= parseInt(end); num++) {
                seats.push(base + num);
            }
        } else {
            errors.push(`无效的座位号：${str}`);
        }
    }
    if (seats.length == 0 && errors.length == 0) {
        errors.push('未指定座位号');
    }

    if (errors.length > 0) {
        return { type: 'Err', error: errors };
    } else {
        return { type: 'Ok', value: dedup(seats) };
    }
}

/* ----------------------------- core logic -------------------------------- */

function startRuning() {
    payload.appAccNo = state.user.accNo;
    payload.resvMember[0] = state.user.accNo;
    payload.resvBeginTime = `${config.date} ${config.beginTime}:00`;
    payload.resvEndTime = `${config.date} ${config.endTime}:00`;
    option.headers.token = state.user.token;

    switch (config.mode) {
        case 'timing': timingGrab(); break;
        case 'polling': pollingGrab(); break;
        default: throw 'unreachable';
    }
}

function timingGrab() {
    state.status = 'waiting';
    state.countDown = '?';
    updateUI();
    const [h, m] = config.targetTime.split(':').map(s => parseInt(s));
    const target = new Date().setHours(h, m, 0, 0) - config.aheadTime * 1000;
    function checkTime() {
        const distanceMs = target - Date.now();
        if (distanceMs <= 0) {
            pollingGrab();
        } else {
            state.countDown = Math.ceil(distanceMs / 1000);
            updateCountDownUI();
            state.checkingTimer = setTimeout(checkTime, 100);
        }
    }
    checkTime();
}

function pollingGrab() {
      state.status = 'grabing';
      updateUI();
      startGiveUpTimeout();
      grab();
      state.grabingTimer = setInterval(grab, config.interval);
}

function startGiveUpTimeout() {
    state.giveupTimer = setTimeout(() => {
        if (state.status == 'grabing') {
            clearInterval(state.grabingTimer);
            state.status = 'fail';
            state.failMsg = 'TIMEOUT';
            updateUI();
        }
    }, config.timeout * 60 * 1000);
}

function grab() {
    const hit = config.hit, seats = state.targetSeats;
    for (let i = 0; i < hit; i++) {
        for (const seat of seats) {
            payload.resvDev[0] = seat;
            option.body = JSON.stringify(payload);
            fetch(RESV_URL, option)
              .then(parseResponse)
              .then(checkGrabResult)
              .catch(ignoreError);
        }
    }
    state.requestCount += seats.length * hit;
    updateResquestCountUI();
}

function ignoreError() {}

function parseResponse(resp) {
    return resp.json();
}

function checkGrabResult(result) {
    if (result.code == 0) {
        clearInterval(state.grabingTimer);
        state.status = 'success';
        state.successData = result.data;
        updateUI();
    } else {
        if (result.message.endsWith('当前时段有预约') && state.status == 'grabing') {
            clearInterval(state.grabingTimer);
            state.status = 'fail';
            state.failMsg = '你当前所选时段已有预约';
            updateUI();
        }
    }
}

/* ---------------------- utils ---------------------- */

function fmtDate(dt) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function fmtTime(dt) {
    const h = String(dt.getHours()).padStart(2, '0');
    const m = String(dt.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

function dedup(arr) {
    return Array.from(new Set(arr));
}
