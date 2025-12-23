import Freeform from './freeform';
import HorizontalLine from './horizontal-line';
import LineSegment from './line-segment';
import Point from './point';
import Polyline from './polyline';
import Spline from './spline';
import Stamp from './stamp';
import VerticalLine from './vertical-line';

export const VERSION = '0.1';

export default class Group {
  constructor(params, app, lowPriority = false) {
    if (app.debug) {
      if (typeof params.label !== 'string') {
        // eslint-disable-next-line no-param-reassign
        params.label = 'Group'; // Default value
      }
    }
    this.params = params;
    this.app = app;
    const items = [];
    const plugins = this.params.plugins.map((pluginParams) => pluginParams.name);
    plugins.forEach((name, index) => {
      this.params.plugins[index].isSubItem = true;
      // There are 4 base canvas elements for frame and axes, so lowest priority is inserted after those
      if (lowPriority) {
        this.params.plugins[index].zIndex = 4 + index;
      }
      const plugin = this.createPlugin(name, this.params.plugins[index], this.app);
      items.push(plugin.menuItem);
    });
    this.menuItem = {
      type: 'splitbutton',
      id: this.params.id,
      items,
      name: this.params.name,
      label: this.params.label,
      icon: items[0].icon,
      color: items[0].color,
    };
    this.app.registerToolbarItem(this.menuItem);
  }

  // eslint-disable-next-line class-methods-use-this
  createPlugin(name, params, app) {
    switch (name) {
      case 'freeform':
        return new Freeform(params, app);
      case 'horizontal-line':
        return new HorizontalLine(params, app);
      case 'line-segment':
        return new LineSegment(params, app);
      case 'point':
        return new Point(params, app);
      case 'polyline':
        return new Polyline(params, app);
      case 'spline':
        return new Spline(params, app);
      case 'stamp':
        return new Stamp(params, app);
      case 'vertical-line':
        return new VerticalLine(params, app);
      default:
        return undefined;
    }
  }
}
