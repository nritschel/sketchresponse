import { EventEmitter } from 'events';

import './util/polyfills';
import createInheritingObjectTree from './util/inheriting-object-tree';
import { disableDoubleTapZoom, preventClickDelay } from './util/workarounds';
import colorIcon from './util/color-icon';

import NotificationManager from './notification-manager';
import GradeableManager from './gradeable-manager';
import StateManager from './state-manager';
import HistoryManager from './history-manager';
import ElementManager from './element-manager';
import deepCopy from './util/deep-copy';

import Toolbar from './toolbar';
import Group from "./plugins/group";

import deleteSvg from './delete-icon.svg';
import selectSvg from './select-icon.svg';
import undoSvg from './undo-icon.svg';
import redoSvg from './redo-icon.svg';
import helpSvg from './help-icon.svg';

// Load all CSS
import 'normalize.css';
import 'katex/dist/katex.css';
import '../styles/main.scss';

import deepExtend from 'deep-extend';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

const DEFAULT_CONFIG = {
  width: 750,
  height: 420,
  xrange: [-4.5, 4.5],
  yrange: [-2.5, 2.5],
  xscale: 'linear',
  yscale: 'linear',
  coordinates: 'cartesian',
  readonly: false,
  enforceBounds: false,
  safetyBuffer: 0,
};

export default class SketchInput {
  constructor(el, id, config) {
    if (!(el instanceof HTMLElement)) {
      throw new TypeError(
        'The first argument to the SketchInput constructor must be an HTMLElement',
      );
    }

    this.el = el;
    this.id = id;
    if (config.initialstate) {
      this.initialState = deepCopy(config.initialstate);
      delete config.initialstate;
    }
    // Check if we are in debug mode
    this.debug = typeof config.debug === 'boolean' ? config.debug : false;
    // Overwrite default keys/values
    this.config = deepExtend(deepCopy(DEFAULT_CONFIG), config);
    this.params = createInheritingObjectTree(this.config);
    this.messageBus = new EventEmitter();
    this.oldTime = Date.now();
    this.oldPt = {
      x: 0,
      y: 0,
    };

    Promise.all(
      this.params.plugins.map((pluginParams) =>
        import(`./plugins/${pluginParams.name}`).then((module) => module.default),
      ),
    ).then((plugins) => this.init(plugins));
  }

  init(plugins) {
    this.el.innerHTML = `
      <menu id="${this.id}-si-toolbar" class="si-toolbar${this.params.readonly ? ' disable' : ''}"></menu>
      <svg id="${this.id}-si-canvas" class="si-canvas" touch-action="none" width="${this.params.width}" height="${this.params.height}">
        <rect width="100%" height="100%" fill="#F0F0F0" />
        <rect x="${this.config.safetyBuffer}" y="${this.config.safetyBuffer}" width="${this.config.width-2*this.config.safetyBuffer}" height="${this.config.height-2*this.config.safetyBuffer}" fill="white" />
      </svg>
      <div id="${this.id}-si-attribution" class="si-attribution">
        <a id="${this.id}-si-show-legal" href="#">Made with <span aria-label="love">&hearts;</span> at MIT, adapted for PrairieLearn</a>
      </div>
      <div id="${this.id}-si-help" class="si-help-legal" data-visible="false">
        <div role="dialog" class="si-dialog">
          <header>
            <h1>How to use the sketching editor</h1>
          </header>
          <p>
            Select a tool from the toolbar at the top and draw onto the canvas by dragging with your mouse or finger. You can move elements or individual line segments by dragging them with the "Select" tool. Different questions might provide you with different sketching tools, and some might contain pre-drawn elements that cannot be edited or deleted.
          </p>
          <p>
            When using the free-form function drawing tool, you can draw and move individual function segments separately. When using the spline or line segment tool, you can draw individual points that are connected automatically. To finish drawing a line with those tools, select a different tool or press Enter on your keyboard.
          </p>
          <p>
            To delete an element, first click on it with the "Select" tool, then use the "Delete" button on the right. You can also use the right buttons or keyboard shortcuts to undo and redo drawing steps. Different questions might provide you with different sketching tools, and some might contain pre-drawn elements that cannot be edited or deleted.
          </p>
        </div>
      </div>
      <div id="${this.id}-si-legal" class="si-help-legal" data-visible="false">
        <div role="dialog" class="si-dialog">
          <header>
            <h1>SketchResponse</h1>
            <p class="si-copyright">
              Copyright (c) 2015-2016 Massachusetts Institute of Technology.
            </p>
          </header>
          <p>
            SketchResponse is an open-source graphical input and assessment tool for online learning
            platforms. The code and documentation for this project (including instructions for course authors wishing to
            create their own sketch problems) are freely available at
            <a href="https://github.com/SketchResponse/sketchresponse" target="_blank">github.com/SketchResponse</a>.
            We welcome collaborators and are open to any feedback you may have!
          </p>
          <p>
            This library is free software; you can redistribute it and/or modify it under the terms of the GNU Lesser
            General Public License as published by the Free Software Foundation. Please see our <a href="LICENSE.txt"
            target="_blank">LICENSE file</a> for complete license terms.
          </p>
          <p>
            SketchResponse also uses third-party code and creative-commons licensed content which are distributed under
            their own license terms; details may be found in the LICENSE file linked above.
          </p>
        </div>
      </div>
    `;

    // Workaround for iOS Safari and Chrome (the latter supports the touch-action CSS property,
    // but let's keep everything the same for now). TODO: remove if implemented in PEP or WebKit.
    disableDoubleTapZoom(this.el);

    // Prevent click delay on touch devices. TODO: remove when handled by CSS touch-action or PEP.
    preventClickDelay(this.el);

    const showLegal = document.getElementById(`${this.id}-si-show-legal`);
    const legalDialog = document.querySelector(`#${this.id}-si-legal`);
    const helpDialog = document.querySelector(`#${this.id}-si-help`);

    showLegal.addEventListener('click', (event) => {
      event.preventDefault();
      legalDialog.setAttribute('data-visible', 'true');
    });

    legalDialog.addEventListener('click', () => legalDialog.setAttribute('data-visible', 'false'));
    legalDialog.addEventListener('click', (event) => event.stopPropagation());
    helpDialog.addEventListener('click', () => helpDialog.setAttribute('data-visible', 'false'));
    helpDialog.addEventListener('click', (event) => event.stopPropagation());

    this.notificationManager = new NotificationManager(this.config, this.messageBus);
    this.gradeableManager = new GradeableManager(this.config, this.messageBus);
    this.stateManager = new StateManager(this.config, this.messageBus, this.initialState);
    this.historyManager = new HistoryManager(this.config, this.messageBus, this.stateManager);

    this.app = {
      id: this.id,
      registerState: (entry) => this.messageBus.emit('registerState', entry),
      registerGradeable: (entry) => this.messageBus.emit('registerGradeable', entry),
      registerToolbarItem: (entry) => this.messageBus.emit('registerToolbarItem', entry),
      addUndoPoint: () => this.messageBus.emit('addUndoPoint'),
      __messageBus: this.messageBus,
      svg: document.getElementById(`${this.id}-si-canvas`),
      debug: this.debug,
    };

    // Prevent default on dragstart to keep Firefox from dragging the SVG
    // setting capture to true to get the event as soon as possible
    // NOTE: Cannot use mousedown here since that also prevents mouse move/up
    // from being captured when the mouse leaves the window/iframe (in Chrome at least)
    this.app.svg.addEventListener('dragstart', (event) => event.preventDefault(), true);

    this.toolbar = new Toolbar(this.id, this.params, this.app);
    this.elementManager = new ElementManager(this.app, this.config.enforceBounds);
    this.app.registerElement = this.elementManager.registerElement.bind(this.elementManager);

    // Disable multiple pointerdown events if the events are close together in time and distance:
    // Less or equal to 500 ms and less or equal to 10 px.
    // Double clicks are still enabled though when they happen on a label element.
    document.addEventListener('pointerdown', (event) => {
      const newTime = Date.now();
      const deltaT = newTime - this.oldTime;
      const newPt = {
        x: event.clientX,
        y: event.clientY,
      };
      const dist = Math.sqrt(
        (newPt.x - this.oldPt.x) * (newPt.x - this.oldPt.x) +
        (newPt.y - this.oldPt.y) * (newPt.y - this.oldPt.y),
      );
      if (deltaT <= 500 && dist <= 10) {
        // Stop event propagation except when it happens on a tag where a double click
        // will open a SweetAlert2 window for editing.
        // Tags are either a text node with a 'tag' class name. Or a Katex foreignElement, also
        // with a 'tag' class name, containing span children.
        if (event.target.getAttribute('class') !== 'tag' && event.target.tagName !== 'SPAN') {
          event.stopPropagation();
        }
      }
      this.oldTime = newTime;
      this.oldPt.x = newPt.x;
      this.oldPt.y = newPt.y;
    }, true);

    // Add stateful buttons (Select and plugins) to the left of the toolbar
    this.app.registerToolbarItem({
      type: 'button',
      id: 'select',
      label: 'Select',
      icon: {
        src: colorIcon(selectSvg, 'none', 'black'),
        alt: 'Select',
      },
      color: 'black',
      activate: () => {
        // Temporarily hold a reference for ulterior removal
        this.handlePointerDown = () => {
          this.messageBus.emit('deselectAll');
        };
        this.app.svg.addEventListener('pointerdown', this.handlePointerDown);
        this.app.svg.style.cursor = 'default';
      },
      deactivate: () => {
        this.app.svg.removeEventListener('pointerdown', this.handlePointerDown);
        // Remove the temporary reference
        delete this.handlePointerDown;
      },
      action: () => {
        this.messageBus.emit('enableSelectMode');
        this.messageBus.emit('activateItem', 'select');
      },
    });

    const helpers = []
    plugins.forEach((Plugin, idx) => {
      if (this.params.readonly) {
        this.params.plugins[idx]["readonly"] = true;
      }
      if (!this.params.plugins[idx].readonly && this.params.plugins[idx].helper) {
        helpers.push(idx);
      }
      else {
        new Plugin(this.params.plugins[idx], this.app);
      }
    });

    if (helpers.length > 0) {
      this.app.registerToolbarItem({ type: 'separator' });
      const helperGroup = {
        name: 'group',
        id: 'helpers',
        label: 'Helpers (ungraded)',
        plugins: []
      }
      helpers.forEach((idx) => {
        helperGroup.plugins.push(this.params.plugins[idx])
      })
      new Group(helperGroup, this.app, true);
    }

    document.addEventListener('pointerdown', () => this.messageBus.emit('closeDropdown'), true);

    // Add action buttons (Delete, Undo, and Redo) to the right of the toolbar
    // TODO: factor into... something
    this.app.registerToolbarItem({ type: 'separator' });
    this.app.registerToolbarItem({
      type: 'button',
      id: 'delete',
      label: 'Delete',
      icon: {
        src: colorIcon(deleteSvg, 'none', 'black'),
        alt: 'Delete',
      },
      action: () => this.messageBus.emit('deleteSelected'),
    });
    this.app.registerToolbarItem({
      type: 'button',
      id: 'undo',
      label: 'Undo',
      icon: {
        src: colorIcon(undoSvg, 'none', 'black'),
        alt: 'Undo',
      },
      action: () => this.messageBus.emit('undo'),
    });
    this.app.registerToolbarItem({
      type: 'button',
      id: 'redo',
      label: 'Redo',
      icon: {
        src: colorIcon(redoSvg, 'none', 'black'),
        alt: 'Redo',
      },
      action: () => this.messageBus.emit('redo'),
    });
    this.app.registerToolbarItem({
      type: 'button',
      id: 'help',
      label: 'Help',
      icon: {
        src: colorIcon(helpSvg, 'none', 'black'),
        alt: 'Help',
      },
      action: () => helpDialog.setAttribute('data-visible', 'true'),
    });

    this.messageBus.emit('enableSelectMode');
    this.messageBus.emit('activateItem', 'select');

    // Global keyboard shortcuts (TODO: move elsewhere?)
    /*
      Initially, MouseTrap was used here: https://www.npmjs.com/package/mousetrap
      But its Apache version 2 license is incompatible except if were to be linked dynamically which
      is not possible here.
      We use KeyMaster instead and its MIT license:
      https://www.npmjs.com/package/keymaster

      NOTE:
      MouseTrap uses KeyboardEvent.which:
      https://github.com/ccampbell/mousetrap/blob/master/mousetrap.js

      KeyMaster uses KeyboardEvent.keyCode:
      https://github.com/madrobby/keymaster/blob/master/keymaster.js

      that are deprecated (as KeyboardEvent.char and KeyboardEvent.charCode):
      https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent

      KeyboardEvent.key is recommended and a polyfill exists:
      https://www.npmjs.com/package/keyboardevent-key-polyfill
    */

    const messageBus = this.messageBus;
    this.el.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault(); 
        messageBus.emit('undo');
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || event.key === 'z' && event.shiftKey)) {
        event.preventDefault(); 
        messageBus.emit('redo');
      }
      if (event.key === 'Escape') {
        event.preventDefault(); 
        messageBus.emit('deselectAll')
      }
      if (event.key === 'Enter') {
        event.preventDefault(); 
        event.stopPropagation();
        messageBus.emit('finalizeShapes')
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault(); 
        messageBus.emit('deleteSelected')
      }
    });

    // Allow multitouch zoom on SVG element (TODO: move elsewhere?)
    this.app.svg.addEventListener('touchstart', (event) => {
      if (event.touches.length > 1) this.app.svg.setAttribute('touch-action', 'auto');
    }, true);

    this.app.svg.addEventListener('touchend', (event) => {
      if (event.touches.length === 0) this.app.svg.setAttribute('touch-action', 'none');
    }, true);

    this.messageBus.on('showLimitWarning', () => {
      let popup = document.querySelector('#warning-popup');
      if (!popup) {
        this.el.insertAdjacentHTML('beforeend', `<div id="warning-popup" class="position-absolute translate-middle-x start-50" style="margin-top:100px;"></div>`);
        popup = document.querySelector('#warning-popup');
      }
      // Only show one popup with the same ID at the same time
      if (!document.querySelector('#popup-limit')) {
        popup.insertAdjacentHTML('beforeend', 
          `<div id="popup-limit"
              class="show p-1 alert alert-dismissible alert-warning"
              style="padding-right:2rem!important;"
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
            ><div>You have already used the currently selected tool the maximum allowed number of times!</div>
              <button
                type="button"
                class="btn-close"
                data-bs-dismiss="alert"
                aria-label="Close"
              ></button>
            </div>`);
      }
    });

    this.messageBus.on('showDeleteWarning', () => {
      let popup = document.querySelector('#warning-popup');
      if (!popup) {
        this.el.insertAdjacentHTML('beforeend', `<div id="warning-popup" class="position-absolute translate-middle-x start-50" style="margin-top:100px;"></div>`);
        popup = document.querySelector('#warning-popup');
      }
      // Only show one popup with the same ID at the same time
      if (!document.querySelector('#popup-limit')) {
        popup.insertAdjacentHTML('beforeend', 
          `<div id="popup-limit"
              class="show p-1 alert alert-dismissible alert-warning"
              style="padding-right:2rem!important;"
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
            ><div>You need to select a drawing (with the "Select" tool) before you can delete it!</div>
              <button
                type="button"
                class="btn-close"
                data-bs-dismiss="alert"
                aria-label="Close"
              ></button>
            </div>`);
      }
    });

    this.messageBus.on('deleteFinished', () => { this.app.addUndoPoint(); });

    if (this.initialState) this.messageBus.emit('loadInitialState');

    this.messageBus.emit('ready');
  }

  setState(state) { return this.stateManager.setState(state); }

  getState() { return this.stateManager.getState(); }

  getGradeable() { return this.gradeableManager.getGradeable(); }
}
