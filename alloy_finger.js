/* AlloyFinger v0.1.15
 * By dntzhang
 * Github: https://github.com/AlloyTeam/AlloyFinger
 */
; (function () {
    function getLen(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y);
    }

    function dot(v1, v2) {
        return v1.x * v2.x + v1.y * v2.y;
    }

    function getAngle(v1, v2) {
        var mr = getLen(v1) * getLen(v2);
        if (mr === 0) return 0;
        var r = dot(v1, v2) / mr;
        if (r > 1) r = 1;
        return Math.acos(r);
    }

    function cross(v1, v2) {
        return v1.x * v2.y - v2.x * v1.y;
    }

    function getRotateAngle(v1, v2) {
        var angle = getAngle(v1, v2);
        if (cross(v1, v2) > 0) {
            angle *= -1;
        }

        return angle * 180 / Math.PI;
    }

    var HandlerAdmin = function (el) {
        this.handlers = [];
        this.el = el;
    };

    HandlerAdmin.prototype.add = function (handler) {
        this.handlers.push(handler);
    }

    HandlerAdmin.prototype.del = function (handler) {
        if (!handler) this.handlers = [];

        for (var i = this.handlers.length; i >= 0; i--) {
            if (this.handlers[i] === handler) {
                this.handlers.splice(i, 1);
            }
        }
    }

    HandlerAdmin.prototype.dispatch = function () {
        for (var i = 0, len = this.handlers.length; i < len; i++) {
            var handler = this.handlers[i];
            if (typeof handler === 'function') handler.apply(this.el, arguments);
        }
    }

    function wrapFunc(el, handler) {
        var handlerAdmin = new HandlerAdmin(el);
        handlerAdmin.add(handler);

        return handlerAdmin;
    }

    var AlloyFinger = function (el, option) {

        if (!option.config) {
            option.config = {}
        }
        this.element = typeof el == 'string' ? document.querySelector(el) : el;

        this.start = this.start.bind(this);
        this.move = this.move.bind(this);
        this.end = this.end.bind(this);
        this.cancel = this.cancel.bind(this);
        this.element.addEventListener("touchstart", this.start, false);
        this.element.addEventListener("touchmove", this.move, false);
        this.element.addEventListener("touchend", this.end, false);

        this.element.addEventListener("mousedown", this.start, false);
        this.element.addEventListener("mousemove", this.move, false);

        this.element.addEventListener("click", this.end, false);
        this.element.addEventListener("touchcancel", this.cancel, false);

        this.preV = { x: null, y: null };
        this.pinchStartLen = null;
        this.zoom = 1;
        this.isDoubleTap = false;

        var noop = function () { };

        this.rotate = wrapFunc(this.element, option.rotate || noop);
        this.touchStart = wrapFunc(this.element, option.touchStart || noop);

        this.multipointStart = wrapFunc(this.element, option.multipointStart || noop);
        this.multipointEnd = wrapFunc(this.element, option.multipointEnd || noop);
        this.pinch = wrapFunc(this.element, option.pinch || noop);
        this.swipe = wrapFunc(this.element, option.swipe || noop);
        this.tap = wrapFunc(this.element, option.tap || noop);
        this.doubleTap = wrapFunc(this.element, option.doubleTap || noop);
        this.longTap = wrapFunc(this.element, option.longTap || noop);
        this.singleTap = wrapFunc(this.element, option.singleTap || noop);
        this.pressMove = wrapFunc(this.element, option.pressMove || noop);
        this.twoFingerPressMove = wrapFunc(this.element, option.twoFingerPressMove || noop);
        this.touchMove = wrapFunc(this.element, option.touchMove || noop);
        this.touchEnd = wrapFunc(this.element, option.touchEnd || noop);
        this.touchCancel = wrapFunc(this.element, option.touchCancel || noop);

        this._cancelAllHandler = this.cancelAll.bind(this);

        window.addEventListener('scroll', this._cancelAllHandler);

        this.delta = null;
        this.last = null;
        this.now = null;
        this.tapTimeout = null;
        this.singleTapTimeout = null;
        this.longTapTimeout = null;
        this.swipeTimeout = null;
        this.x1 = this.x2 = this.y1 = this.y2 = null;
        this.preTapPosition = { x: null, y: null };
        this.active = null
        this.config = {
            swipeDistanceThreshold: option.config.swipeDistanceThreshold || 100, //
            swipeVelocityThreshold: option.config.swipeVelocityThreshold || 0.3  // px per ms
        }
        this.isTouchDevice = false

    };

    AlloyFinger.prototype = {
        start: function (evt) {

            // handle devices that dispatch touch AND mouse events, eg desktop browser in touch emulation mode
            // in this case, ignore mouse events
            if (evt.touches) {
                this.isTouchDevice = true;
            }
            if (!evt.touches && this.isTouchDevice) {
                return
            }
            this.active = true
            //  if (!evt.touches) return;
            this.now = Date.now();

            this.x1 = evt.pageX || evt.touches[0].pageX;
            this.y1 = evt.pageY || evt.touches[0].pageY;
            this.delta = this.now - (this.last || this.now);

            this.touchStart.dispatch(evt, this.element);
            if (this.preTapPosition.x !== null) {
                this.isDoubleTap = (this.delta > 100 && this.delta <= 300 && Math.abs(this.preTapPosition.x - this.x1) < 30 && Math.abs(this.preTapPosition.y - this.y1) < 30);
                if (this.isDoubleTap) {
                    this.shouldPreventDefault = true
                    clearTimeout(this.singleTapTimeout);
                }
            }
            this.preTapPosition.x = this.x1;
            this.preTapPosition.y = this.y1;
            this.last = this.now;
            var preV = this.preV,
                len = evt.touches ? evt.touches.length : 1;
            if (len > 1) {
                this.shouldPreventDefault = true
                this._cancelLongTap();
                this._cancelSingleTap();
                var v = { x: evt.touches[1].pageX - this.x1, y: evt.touches[1].pageY - this.y1 };
                preV.x = v.x;
                preV.y = v.y;
                this.pinchStartLen = getLen(preV);
                this.multipointStart.dispatch(evt, this.element);
            }
            this._preventTap = false;
            this.longTapTimeout = setTimeout(function () {
                this.longTap.dispatch(evt, this.element);
                this._preventTap = true;
            }.bind(this), 750);
        },
        move: function (evt) {
            // if (!evt.touches) return;

            if (!evt.touches && !this.active) {
                return
            }
            this.shouldPreventDefault = true
            var preV = this.preV,
                len = evt.touches ? evt.touches.length : 1;
            currentX = evt.pageX || evt.touches[0].pageX;
            currentY = evt.pageY || evt.touches[0].pageY;

            this.isDoubleTap = false;
            if (len > 1) {
                var sCurrentX = evt.touches[1].pageX,
                    sCurrentY = evt.touches[1].pageY
                var v = { x: evt.touches[1].pageX - currentX, y: evt.touches[1].pageY - currentY };

                if (preV.x !== null) {
                    if (this.pinchStartLen > 0) {
                        evt.zoom = getLen(v) / this.pinchStartLen;
                        this.pinch.dispatch(evt, this.element);
                    }

                    evt.angle = getRotateAngle(v, preV);
                    this.rotate.dispatch(evt, this.element);
                }
                preV.x = v.x;
                preV.y = v.y;

                if (this.x2 !== null && this.sx2 !== null) {
                    evt.deltaX = (currentX - this.x2 + sCurrentX - this.sx2) / 2;
                    evt.deltaY = (currentY - this.y2 + sCurrentY - this.sy2) / 2;
                } else {
                    evt.deltaX = 0;
                    evt.deltaY = 0;
                }
                this.twoFingerPressMove.dispatch(evt, this.element);

                this.sx2 = sCurrentX;
                this.sy2 = sCurrentY;
            } else {
                if (this.x2 !== null) {
                    evt.deltaX = currentX - this.x2;
                    evt.deltaY = currentY - this.y2;

                    //move事件中添加对当前触摸点到初始触摸点的判断，
                    //如果曾经大于过某个距离(比如10),就认为是移动到某个地方又移回来，应该不再触发tap事件才对。
                    var movedX = Math.abs(this.x1 - this.x2),
                        movedY = Math.abs(this.y1 - this.y2);

                    if (movedX > 5 || movedY > 5) {
                        this._preventTap = true;
                    }

                } else {
                    evt.deltaX = 0;
                    evt.deltaY = 0;
                }


                this.pressMove.dispatch(evt, this.element);
            }

            this.touchMove.dispatch(evt, this.element);

            this._cancelLongTap();
            this.x2 = currentX;
            this.y2 = currentY;

            if (len > 1) {
                evt.preventDefault();
            }
        },
        end: function (evt) {
            this.active = false
            var self = this;
            if (evt.touches && !evt.changedTouches) return;
            if (this.shouldPreventDefault == true) {
                evt.preventDefault()
                setTimeout(function () { self.shouldPreventDefault = false }, 100)
            }
            this._cancelLongTap();
            var self = this;
            if (evt.touches && evt.touches.length < 2) {
                this.multipointEnd.dispatch(evt, this.element);
                this.sx2 = this.sy2 = null;
            }

            //swipe
            var actionableEvent = false;
            var xMovement = Math.abs(this.x1 - this.x2)
            var yMovement = Math.abs(this.y1 - this.y2)
            var endTime = Date.now()
            var actionTime = endTime - this.now;

            if ((this.x2 &&
                xMovement > this.config.swipeDistanceThreshold &&
                xMovement / actionTime > this.config.swipeVelocityThreshold
            ) ||
                (
                    this.y2 &&
                    yMovement > this.config.swipeDistanceThreshold &&
                    yMovement / actionTime > this.config.swipeVelocityThreshold
                )) {

                actionableEvent = true;
                evt.direction = this._swipeDirection(this.x1, this.x2, this.y1, this.y2);
                this.swipeTimeout = setTimeout(function () {
                    self.swipe.dispatch(evt, self.element);
                }, 0)

            }
            else {
                this.tapTimeout = setTimeout(function () {
                    if (!self._preventTap) {
                        actionableEvent = true;
                        self.tap.dispatch(evt, self.element);
                    }
                    // trigger double tap immediately
                    if (self.isDoubleTap) {
                        actionableEvent = true
                        self.doubleTap.dispatch(evt, self.element);
                        self.isDoubleTap = false;
                    }
                }, 0)

                if (!self.isDoubleTap && !self._preventTap) {
                    actionableEvent = true
                    self.singleTapTimeout = setTimeout(function () {
                        self.singleTap.dispatch(evt, self.element);
                    }, 250);
                }
            }

            this.touchEnd.dispatch(evt, this.element, actionableEvent);

            this.preV.x = 0;
            this.preV.y = 0;
            this.zoom = 1;
            this.pinchStartLen = null;
            this.x1 = this.x2 = this.y1 = this.y2 = null;
        },
        cancelAll: function () {
            this._preventTap = true
            clearTimeout(this.singleTapTimeout);
            clearTimeout(this.tapTimeout);
            clearTimeout(this.longTapTimeout);
            clearTimeout(this.swipeTimeout);
        },
        cancel: function (evt) {
            this.cancelAll()
            this.touchCancel.dispatch(evt, this.element);
        },
        _cancelLongTap: function () {
            clearTimeout(this.longTapTimeout);
        },
        _cancelSingleTap: function () {
            clearTimeout(this.singleTapTimeout);
        },
        _swipeDirection: function (x1, x2, y1, y2) {
            return Math.abs(x1 - x2) >= Math.abs(y1 - y2) ? (x1 - x2 > 0 ? 'Left' : 'Right') : (y1 - y2 > 0 ? 'Up' : 'Down')
        },

        on: function (evt, handler) {
            if (this[evt]) {
                this[evt].add(handler);
            }
        },

        off: function (evt, handler) {
            if (this[evt]) {
                this[evt].del(handler);
            }
        },

        destroy: function () {
            if (this.singleTapTimeout) clearTimeout(this.singleTapTimeout);
            if (this.tapTimeout) clearTimeout(this.tapTimeout);
            if (this.longTapTimeout) clearTimeout(this.longTapTimeout);
            if (this.swipeTimeout) clearTimeout(this.swipeTimeout);

            this.element.removeEventListener("touchstart", this.start);
            this.element.removeEventListener("touchmove", this.move);
            this.element.removeEventListener("touchend", this.end);
            this.element.removeEventListener("mousedown", this.start);
            this.element.removeEventListener("mousemove", this.move);
            this.element.removeEventListener("click", this.end);
            this.element.removeEventListener("touchcancel", this.cancel);

            this.rotate.del();
            this.touchStart.del();
            this.multipointStart.del();
            this.multipointEnd.del();
            this.pinch.del();
            this.swipe.del();
            this.tap.del();
            this.doubleTap.del();
            this.longTap.del();
            this.singleTap.del();
            this.pressMove.del();
            this.twoFingerPressMove.del()
            this.touchMove.del();
            this.touchEnd.del();
            this.touchCancel.del();

            this.preV = this.pinchStartLen = this.zoom = this.isDoubleTap = this.delta = this.last = this.now = this.tapTimeout = this.singleTapTimeout = this.longTapTimeout = this.swipeTimeout = this.x1 = this.x2 = this.y1 = this.y2 = this.preTapPosition = this.rotate = this.touchStart = this.multipointStart = this.multipointEnd = this.pinch = this.swipe = this.tap = this.doubleTap = this.longTap = this.singleTap = this.pressMove = this.touchMove = this.touchEnd = this.touchCancel = this.twoFingerPressMove = null;

            window.removeEventListener('scroll', this._cancelAllHandler);
            return null;
        }
    };

    if (typeof module !== 'undefined' && typeof exports === 'object') {
        module.exports = AlloyFinger;
    } else {
        window.AlloyFinger = AlloyFinger;
    }
})();
