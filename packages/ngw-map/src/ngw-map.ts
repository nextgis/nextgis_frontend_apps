import { WebMap, MapAdapter, StarterKit } from '@nextgis/webmap';
import { NgwConnector } from '@nextgis/ngw-connector';
import { QmsKit } from '@nextgis/qms-kit';
import { NgwKit } from '@nextgis/ngw-kit';

// import { WebMap, MapAdapter, StarterKit } from '../../../nextgisweb_frontend/packages/webmap/src/webmap';
// import { NgwConnector } from '../../../nextgisweb_frontend/packages/ngw-connector/src/ngw-connector';
// import { QmsKit } from '../../../nextgisweb_frontend/packages/qms-kit/src/QmsKit';
// import { NgwKit } from '../../../nextgisweb_frontend/packages/ngw-kit/src/ngw-kit';

import 'leaflet/dist/leaflet.css';
import { onMapLoad } from './decorators';

import { fixUrlStr } from './utils';

export interface MapOptions {
  target: string;
  qmsId?: number;
  webmapId?: number;
  baseUrl: string;
  center?: [number, number];
  zoom?: number;
  bounds?: [number, number, number, number];
}

export interface NgwLayerOptions {
  id: number;
  adapter?: 'IMAGE' | 'TILE';
}

export default class NgwMap {

  static utils = { fixUrlStr };
  static decorators = { onMapLoad };

  options: MapOptions = {
    target: 'map',
    baseUrl: 'http://dev.nextgis.com/sandbox',
  };

  webMap: WebMap;

  isLoaded: boolean = false;
  connector: NgwConnector;
  _ngwLayers = {};

  constructor(mapAdapter: MapAdapter, options: MapOptions) {
    this.options = { ...this.options, ...options };
    this.connector = new NgwConnector({ baseUrl: this.options.baseUrl });
    // const kits: StarterKit[] = [new QmsKit()];
    const kits: any[] = [new QmsKit()];
    if (this.options.webmapId) {
      kits.push(new NgwKit({
        baseUrl: this.options.baseUrl,
        resourceId: this.options.webmapId
      }));
    }
    this.webMap = new WebMap({
      mapAdapter,
      starterKits: kits
    });
    this._createWebMap().then(() => {
      this._addControls();
      this.isLoaded = true;
    });
  }

  fit() {
    const { center, zoom, bounds } = this.options;
    if (center) {
      this.webMap.map.setCenter(center);
      if (zoom) {
        this.webMap.map.setZoom(zoom);
      }
    } else if (bounds) {
      this.fitBounds(bounds);
    }
  }

  /**
   * top, left, bottom, right
   */
  fitBounds(bounds: [number, number, number, number]) {
    const [top, left, bottom, right] = bounds;
    // [extent_left, extent_bottom, extent_right, extent_top];
    this.webMap.map.fit([left, bottom, right, top]);
  }

  @onMapLoad()
  addNgwLayer(options: NgwLayerOptions) {
    return NgwKit.addNgwLayer(options, this.webMap, this.options.baseUrl).then((layer) => {
      this._ngwLayers[layer.name] = layer;
      this.webMap.map.showLayer(layer.name);
      return layer.name;
    });
  }

  zoomToLayer(id: string | number) {
    if (this._ngwLayers[id]) {
      return this.connector.request('resource.item', { id }).then((resp) => {
        if (resp) {
          if (resp.resource.cls === 'raster_style') {
            return this.connector.request('resource.item', {
              id: resp.resource.parent.id
            }).then((res) => {
              return this._fitNgwLayerExtend(res.resource.id);
            });
          } else {
            return this._fitNgwLayerExtend(id);
          }
        }
      });
    }
  }

  private _fitNgwLayerExtend(id) {
    return this.connector.request('layer.extent', { id }).then((resp) => {
      const { maxLat, maxLon, minLat, minLon } = resp.extent;
      this.fitBounds([maxLat, maxLon, minLat, minLon]);
    });
  }

  private _createWebMap() {
    return this.webMap.create({
      target: this.options.target
    }).then(() => {
      if (this.options.qmsId) {
        this.webMap.addBaseLayer(String(this.options.qmsId), 'QMS', {
          qmsid: this.options.qmsId
        }).then((layer) => {
          this.webMap.map.showLayer(layer.name);
        });
      }

      this.fit();
      this.webMap.emitter.emit('map:created');
      // @ts-ignore
      // window.lmap = this.webMap.map.map;
    });
  }

  private _addControls() {

    this.webMap.map.addControl('ZOOM', 'top-left');

    this.webMap.map.addControl('ATTRIBUTION', 'bottom-right', {
      customAttribution: [
        '<a href="http://nextgis.ru" target="_blank">©NextGIS</a>',
      ]
    });
  }
}
