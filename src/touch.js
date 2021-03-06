// Copyright 2014 DeNA Co., Ltd.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


var _Touch = function(engine) {
	this.engine = engine;

	this.isTouch = false;
	this.mouseDown = null;
	this.mouseRelease = null;

	this.currentXY = {x:0, y:0};

	this.keyDownMap = {};

	this.listenerList = [];

	if(this.engine.option.enableTouch) {
		var that = this;

		var pastTypeAsStart = null;
		var pastTypeAsEnd = null;

		this.addListener(document, "keydown", function(e) {
			that.keyDown(e.keyCode);
		}, false);

		var handlerMouseDown = function(e){
			// console.log(e.type, pastTypeAsStart);
			var asTouch = (e.type === 'touchstart');
			if(pastTypeAsStart && e.type !== pastTypeAsStart){
				pastTypeAsStart = null;
				return false;
			} else {
				pastTypeAsStart = e.type;
			}
			// console.log('!! execute as' + e.type);
			that.touchStart.call(that, asTouch ? e.touches[0] : e);
			e.preventDefault();
		};

		var handlerMouseUp = function(e){
			// console.log(e.type, pastTypeAsEnd);
			that.mouseRelease = {x: that.currentXY.x, y: that.currentXY.y};
			if(that.isTouch) {
				if(pastTypeAsEnd && e.type !== pastTypeAsEnd){
					pastTypeAsEnd = null;
					return false;
				} else {
					pastTypeAsEnd = e.type;
				}
				// console.log('!! execute as' + e.type);
				that.touchEnd.call(that, e);
				e.preventDefault();
			}
		};

		if(typeof(window["ontouchstart"]) !== "undefined") {
			this.addListener(engine.container, "touchstart", handlerMouseDown, false);
			this.addListener(document, "touchend", handlerMouseUp, false);
		}
		this.addListener(engine.container, "mousedown", handlerMouseDown, false);
		this.addListener(document, "mouseup", handlerMouseUp, false);
	}
};

_Touch.prototype.getPositionFromEvent = function(e) {
  var ratio = this.engine.option.htmlZoom;
  var bounds = this.engine.canvas.getBoundingClientRect();

	// console.log("pageX/Y X:" + pageX + " Y:" + pageY);
	// console.log("this.engine.container === this.engine.canvas ?");
	// console.log(this.engine.container === this.engine.canvas);
	// console.log("this.engine.canvas.getBoundingClientRect");
	// console.log(bounds);

	var x = (e.pageX - (bounds.left * ratio)) / ratio;
	var y = (e.pageY - (bounds.top * ratio)) / ratio;

	// console.log("zoom ratio: " + ratio);
	// console.log("touched X: " + x + " Y: " + y);
	return {x:x, y:y};
};

_Touch.prototype.keyDown = function(key) {
	console.log("keyDown:"+key);
	this.keyDownMap[key] = true;
};

_Touch.prototype.touchStart = function(e) {
	var xy = this.getPositionFromEvent(e);

	// _touchxと_touchyを設定する
	this.setTouchXY(xy.x, xy.y);

	// 即時反応の場合は即刻処理
	if(this.lightning) {
		this.touchAction(xy.x, xy.y);
		return false;
	}
	// 即時反応でない場合は現在の位置を保存
	this.isTouch = true;
	this.startTime = new Date().getTime();

	this.touchXY = xy; // 初期地点(offsetX/Y)
	this.initXY = xy; // 初期地点
	this.lastXY = xy; // 最終到達地点

	return false;
};

_Touch.prototype.touchEnd = function(e) {
	this.isTouch = false;
	this.mouseRelease = {x: this.lastXY.x, y: this.lastXY.y};
	this.sendKey();
	return false;
};

_Touch.prototype.clearMouseState = function() {
	this.mouseDown = null;
	this.mouseRelease = null;
};

_Touch.prototype.clearKeyDown = function() {
	this.keyDownMap = {};
};

_Touch.prototype.isKeyDown = function(key) {
	return this.keyDownMap[key] || false;
};

_Touch.prototype.touchAction = function(x, y) {
	// set _touchx and _touchy(for api caller)
	// this.setTouchXY(x, y);

	// if ontouch exists, call ontouch function. if it returns false, stop proceeding.
	if(!(this.ontouch && this.ontouch(x, y))) {
		// save mouse down info
		this.mouseDown = {x: x, y: y};
		// don't send key information if lightning === "true"
		if(this.lightning && this.lightning !== true) {
			this.keyDown(this.lightning);
		}
		
		// TODO: flickAssign and lightning is not supported currently
		
		if(!this.lightning && this.flickAssign && this.flickAssign.touch) {
			// if lightning is false, send regular touch info
			this.keyDown(this.flickAssign.touch);
		}
		/*
		if(this.clickableMapping) {
			var idArray = this.engine.getIdentifierFromPosition(x, y);
			for(var i = idArray.length - 1; i >= 0; i--) {
				var id = idArray[i] + "";
				var key = this.clickableMapping[id];
				key && this.keyDown(key);

				// also see MC's name
				var name = id.split('/').pop();
				if(name != id) {
					key = this.clickableMapping[name];
					key && this.keyDown(key);
				}
			}
		}*/
	}
};

// send key info to engine
_Touch.prototype.sendKey = function() {
	if(!this.lastXY || (this.lastXY.x == this.initXY.x && this.lastXY.y == this.initXY.y)) {
		// there is no movement(or dragging), so send touch info
		this.touchAction(this.touchXY.x, this.touchXY.y);
		return;
	}
	// get angle
	if(this.flickAssign) {
		var deg = Math.atan2(this.lastXY.x - this.initXY.x, - this.lastXY.y + this.initXY.y) / Math.PI * 180;
		for(var assignLabel in this.flickAssign) {
			// assignLabel is a string such as "-45:45"
			var assign = assignLabel.split(":");
			if(assign.length == 2) {
				if((assign[0] <= deg && deg <= assign[1]) || (assign[0] <= deg + 360 && deg + 360 <= assign[1])) {
					this.keyDown(this.flickAssign[assignLabel]);
				}
			}
		}
	}
};

// set _touchx, _touchy (hidden option)
_Touch.prototype.setTouchXY = function(x, y) {
	return;
/*	if(this.engine.config.enableXYTouch) {
		// _xtouchと_ytouchをこっそりrootMovieClipに設定する
		this.engine.rootMovieClip.variables["_xtouch"] = Math.floor(x / this.engine.config.scale);
		this.engine.rootMovieClip.variables["_ytouch"] = Math.floor(y / this.engine.config.scale);
	}*/
};

_Touch.prototype.addListener = function(container, name, func, flag) {
	this.listenerList.push([container, name, func]);
	container.addEventListener(name, func, flag);
};

_Touch.prototype.removeAllListeners = function() {
	var len = this.listenerList.length;
	for(var i = 0; i < len; i++) {
		var info = this.listenerList[i];
		info[0].removeEventListener(info[1], info[2], false);
		this.listenerList[i] = null;
	}
};
