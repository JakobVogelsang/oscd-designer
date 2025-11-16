import { LitElement, html, css, TemplateResult, nothing } from 'lit';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
import { property, query, state } from 'lit/decorators.js';

import { EditV2, Transactor } from '@omicronenergy/oscd-api';
import { newEditEventV2 } from '@openscd/oscd-api/utils.js';

import type { Dialog } from '@material/mwc-dialog';
import type { IconButtonToggle } from '@material/mwc-icon-button-toggle';
import '@material/mwc-button';
import '@material/mwc-fab';
import '@material/mwc-icon-button';
import '@material/mwc-icon';

import './sld-editor.js';

import {
  PlaceEvent,
  Point,
  ResetPlaceEvent,
  sldNs,
  StartPlaceEvent,
  createNewSubstation,
  placeElement,
  xmlnsNs,
  setSLDAttributes,
  privType,
  isBusBar,
  eqTypes,
} from './util.js';
import { bayIcon, equipmentIcon, ptrIcon, voltageLevelIcon } from './icons.js';

function makeBusBar(doc: XMLDocument, nsp: string): Element {
  const busBar = doc.createElementNS(doc.documentElement.namespaceURI, 'Bay');
  busBar.setAttribute('name', 'BB1');
  setSLDAttributes(busBar, nsp, { w: '2' });
  const cNode = doc.createElementNS(
    doc.documentElement.namespaceURI,
    'ConnectivityNode'
  );
  cNode.setAttribute('name', 'L');
  const priv = doc.createElementNS(doc.documentElement.namespaceURI, 'Private');
  priv.setAttribute('type', privType);
  const section = doc.createElementNS(sldNs, `${nsp}:Section`);
  setSLDAttributes(section, nsp, { bus: 'true' });
  const v1 = doc.createElementNS(sldNs, `${nsp}:Vertex`);
  setSLDAttributes(v1, nsp, { x: '0.5', y: '0.5' });
  section.appendChild(v1);
  const v2 = doc.createElementNS(sldNs, `${nsp}:Vertex`);
  setSLDAttributes(v2, nsp, { x: '1.5', y: '0.5' });
  section.appendChild(v2);
  priv.appendChild(section);
  cNode.appendChild(priv);
  busBar.appendChild(cNode);
  return busBar;
}

function createElement(doc: XMLDocument, nsp: string, type: string): Element {
  function baseElement(tag: string): Element {
    return doc.createElementNS(doc.documentElement.namespaceURI, tag);
  }

  switch (type) {
    case 'BusBar':
      return makeBusBar(doc, nsp);

    case 'Substation':
      return baseElement('Substation');

    case 'VoltageLevel':
      return baseElement('VoltageLevel');

    case 'Bay':
      return baseElement('Bay');

    case 'ConductingEquipment':
      return baseElement('ConductingEquipment');

    case 'AutoTransformer1W': {
      const element = baseElement('PowerTransformer');
      element.setAttribute('type', 'PTR');
      setSLDAttributes(element, nsp, {
        kind: 'auto',
        rot: '3',
      });
      const winding = baseElement('TransformerWinding');
      winding.setAttribute('type', 'PTW');
      winding.setAttribute('name', 'W1');
      element.appendChild(winding);
      return element;
    }

    case 'AutoTransformer2W': {
      const element = baseElement('PowerTransformer');
      element.setAttribute('type', 'PTR');
      setSLDAttributes(element, nsp, { kind: 'auto' });
      const windings = [];
      for (let i = 1; i <= 2; i += 1) {
        const winding = baseElement('TransformerWinding');
        winding.setAttribute('type', 'PTW');
        winding.setAttribute('name', `W${i}`);
        windings.push(winding);
      }
      element.append(...windings);
      return element;
    }

    case 'Transformer2W': {
      const element = baseElement('PowerTransformer');
      element.setAttribute('type', 'PTR');
      const windings = [];
      for (let i = 1; i <= 2; i += 1) {
        const winding = baseElement('TransformerWinding');
        winding.setAttribute('type', 'PTW');
        winding.setAttribute('name', `W${i}`);
        windings.push(winding);
      }
      element.append(...windings);
      return element;
    }

    case 'Transformer3W': {
      const element = baseElement('PowerTransformer');
      element.setAttribute('type', 'PTR');
      const windings = [];
      for (let i = 1; i <= 3; i += 1) {
        const winding = baseElement('TransformerWinding');
        winding.setAttribute('type', 'PTW');
        winding.setAttribute('name', `W${i}`);
        windings.push(winding);
      }
      element.append(...windings);
      return element;
    }

    case 'EarthingTransformer1W': {
      const element = baseElement('PowerTransformer');
      element.setAttribute('type', 'PTR');
      setSLDAttributes(element, nsp, {
        kind: 'earthing',
      });
      const winding = baseElement('TransformerWinding');
      winding.setAttribute('type', 'PTW');
      winding.setAttribute('name', 'W1');
      element.appendChild(winding);
      return element;
    }

    case 'EarthingTransformer2W': {
      const element = baseElement('PowerTransformer');
      element.setAttribute('type', 'PTR');
      setSLDAttributes(element, nsp, {
        kind: 'earthing',
      });
      const windings = [];
      for (let i = 1; i <= 2; i += 1) {
        const winding = baseElement('TransformerWinding');
        winding.setAttribute('type', 'PTW');
        winding.setAttribute('name', `W${i}`);
        windings.push(winding);
      }
      element.append(...windings);
      return element;
    }

    default:
      throw new Error(`Unknown type: ${type}`);
  }
}

const aboutContent = await fetch(new URL('about.html', import.meta.url)).then(
  res => res.text()
);

export default class OscdEditorSLD extends LitElement {
  @property({ type: Object })
  editor!: Transactor<EditV2>;

  @property({ type: Object })
  doc!: XMLDocument;

  @property({ type: Number })
  docVersion: number = -1;

  @state()
  gridSize = 32;

  @state()
  nsp = 'esldoscd';

  @state()
  placing?: Element;

  @state()
  placingOffset: Point = [0, 0];

  @state() showLabels = true;

  @query('#labels') labelToggleBtn?: IconButtonToggle;

  @query('#about') about?: Dialog;

  zoomIn() {
    this.gridSize += 3;
  }

  zoomOut() {
    this.gridSize -= 3;
    if (this.gridSize < 2) this.gridSize = 2;
  }

  startPlacing(element: Element | undefined, offset: Point = [0, 0]) {
    this.reset();
    this.placing = element;
    this.placingOffset = offset;
  }

  reset() {
    this.placing = undefined;
  }

  handleKeydown = ({ key }: KeyboardEvent) => {
    if (key === 'Escape') this.reset();
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.handleKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.handleKeydown);
  }

  updated(changedProperties: Map<string, any>) {
    if (!changedProperties.has('doc')) return;
    const sldNsPrefix = this.doc.documentElement.lookupPrefix(sldNs);
    if (sldNsPrefix) this.nsp = sldNsPrefix;
    else
      this.doc.documentElement.setAttributeNS(
        xmlnsNs,
        `xmlns:${this.nsp}`,
        sldNs
      );
  }

  placeElement(element: Element, parent: Element, x: number, y: number) {
    const edits = placeElement(this.doc, parent, element, x, y, this.nsp);

    this.reset();
    this.dispatchEvent(newEditEventV2(edits));
  }

  insertSubstation() {
    this.dispatchEvent(newEditEventV2(createNewSubstation(this.doc, this.nsp)));
  }

  labelToggle() {
    this.showLabels = this.labelToggleBtn!.on;
  }

  // eslint-disable-next-line class-methods-use-this
  renderAboutDialog(): TemplateResult {
    return html`${staticHtml`<mwc-dialog id="about" heading="About">
            <div>${unsafeStatic(aboutContent)}</div>
            <mwc-button dialogAction="close" slot="primaryAction">
              close
            </mwc-button>
          </mwc-dialog>`}`;
  }

  renderCancelButton(): TemplateResult {
    return html`${this.placing
      ? html`<mwc-icon-button
          icon="close"
          label="Cancel"
          title="Cancel"
          @click=${() => this.reset()}
        ></mwc-icon-button>`
      : html`<mwc-icon-button
          icon="info"
          label="About"
          title="About"
          @click=${() => this.about?.show()}
        ></mwc-icon-button>`}`;
  }

  renderZoom(): TemplateResult {
    return html`${this.doc.querySelector('Substation')
      ? html`<mwc-icon-button
            icon="zoom_in"
            label="Zoom In"
            title="Zoom In (${Math.round((100 * (this.gridSize + 3)) / 32)}%)"
            @click=${() => this.zoomIn()}
          >
          </mwc-icon-button
          ><mwc-icon-button
            icon="zoom_out"
            label="Zoom Out"
            ?disabled=${this.gridSize < 4}
            title="Zoom Out (${Math.round((100 * (this.gridSize - 3)) / 32)}%)"
            @click=${() => this.zoomOut()}
          ></mwc-icon-button>`
      : nothing}`;
  }

  renderTransformers(): TemplateResult {
    return html`${Array.from(this.doc.documentElement.children).find(
      c => c.tagName === 'Substation'
    )
      ? html`<mwc-fab
            mini
            label="Add Single Winding Auto Transformer"
            title="Add Single Winding Auto Transformer"
            @click=${() => {
          this.startPlacing(
            createElement(this.doc, this.nsp, 'AutoTransformer1W')
          );
        }}
            >${ptrIcon(1, { kind: 'auto' })}</mwc-fab
          ><mwc-fab
            mini
            label="Add Two Winding Auto Transformer"
            title="Add Two Winding Auto Transformer"
            @click=${() => {
          this.startPlacing(
            createElement(this.doc, this.nsp, 'AutoTransformer2W')
          );
        }}
            >${ptrIcon(2, { kind: 'auto' })}</mwc-fab
          ><mwc-fab
            mini
            label="Add Two Winding Transformer"
            title="Add Two Winding Transformer"
            @click=${() => {
          this.startPlacing(
            createElement(this.doc, this.nsp, 'Transformer2W')
          );
        }}
            >${ptrIcon(2)}</mwc-fab
          ><mwc-fab
            mini
            label="Add Three Winding Transformer"
            title="Add Three Winding Transformer"
            @click=${() => {
          this.startPlacing(
            createElement(this.doc, this.nsp, 'Transformer3W')
          );
        }}
            >${ptrIcon(3)}</mwc-fab
          ><mwc-fab
            mini
            label="Add Single Winding Earthing Transformer"
            title="Add Single Winding Earthing Transformer"
            @click=${() => {
          this.startPlacing(
            createElement(this.doc, this.nsp, 'EarthingTransformer1W')
          );
        }}
            >${ptrIcon(1, { kind: 'earthing' })}</mwc-fab
          ><mwc-fab
            mini
            label="Add Two Winding Earthing Transformer"
            title="Add Two Winding Earthing Transformer"
            @click=${() => {
          this.startPlacing(
            createElement(this.doc, this.nsp, 'EarthingTransformer2W')
          );
        }}
            >${ptrIcon(2, { kind: 'earthing' })}</mwc-fab
          >`
      : nothing} `;
  }

  renderVoltLvl(): TemplateResult {
    return html`${Array.from(this.doc.documentElement.children).find(
      c => c.tagName === 'Substation'
    )
      ? html`<mwc-fab
          mini
          label="Add VoltageLevel"
          title="Add VoltageLevel"
          @click=${() => {
          const element = createElement(this.doc, this.nsp, 'VoltageLevel');
          this.startPlacing(element);
        }}
          style="--mdc-theme-secondary: #F5E214;"
        >
          ${voltageLevelIcon}
        </mwc-fab>`
      : nothing} `;
  }

  renderBays(): TemplateResult {
    return html`${this.doc.querySelector(':root > Substation > VoltageLevel')
      ? html`<mwc-fab
            mini
            icon="horizontal_rule"
            @click=${() => {
          const element = createElement(this.doc, this.nsp, 'BusBar');
          this.startPlacing(element);
        }}
            label="Add Bus Bar"
            title="Add Bus Bar"
          >
          </mwc-fab
          ><mwc-fab
            mini
            label="Add Bay"
            title="Add Bay"
            @click=${() => {
          const element = createElement(this.doc, this.nsp, 'Bay');
          this.startPlacing(element);
        }}
            style="--mdc-theme-secondary: #12579B; --mdc-theme-on-secondary: white;"
          >
            ${bayIcon}
          </mwc-fab>`
      : nothing} `;
  }

  renderConductingEquipment(): TemplateResult {
    return html`${Array.from(
      this.doc.querySelectorAll(':root > Substation > VoltageLevel > Bay')
    ).find(bay => !isBusBar(bay))
      ? eqTypes
        .map(
          eqType =>
            html`<mwc-fab
                mini
                label="Add ${eqType}"
                title="Add ${eqType}"
                @click=${() => {
                const element = createElement(
                  this.doc,
                  this.nsp,
                  'ConductingEquipment'
                );
                element.setAttribute('type', eqType);
                this.startPlacing(element);
              }}
                >${equipmentIcon(eqType)}</mwc-fab
              >`
        )
        .concat()
      : nothing} `;
  }

  renderPalette(): TemplateResult {
    return html`<nav>
        ${this.renderConductingEquipment()} ${this.renderBays()}
        ${this.renderVoltLvl()}
        <mwc-fab
          mini
          icon="margin"
          @click=${() => this.insertSubstation()}
          label="Add Substation"
          style="--mdc-theme-secondary: #BB1326; --mdc-theme-on-secondary: white;"
          title="Add Substation"
        ></mwc-fab>
        ${this.renderTransformers()} ${this.renderZoom()}
        ${this.doc.querySelector('VoltageLevel, PowerTransformer')
        ? html`<mwc-icon-button-toggle
              id="labels"
              label="Toggle Labels"
              title="Toggle Labels"
              on
              onIcon="font_download"
              offIcon="font_download_off"
              @click=${() => this.labelToggle()}
            ></mwc-icon-button-toggle>`
        : nothing}
        ${this.renderCancelButton()}
      </nav>
      ${this.renderAboutDialog()}`;
  }

  renderSldEditor(): TemplateResult {
    return html`${Array.from(
      this.doc.querySelectorAll(':root > Substation')
    ).map(
      subs =>
        html`<sld-editor
          .editor=${this.editor}
          .doc=${this.doc}
          .docVersion=${this.docVersion}
          .substation=${subs}
          .gridSize=${this.gridSize}
          .placing=${this.placing}
          .placingOffset=${this.placingOffset}
          .showLabels=${this.showLabels}
          .nsp=${this.nsp}
          @oscd-sld-reset-place=${({
          detail: { element },
        }: ResetPlaceEvent) => {
            if (this.placing === element) {
              this.reset();
            }
          }}
          @oscd-sld-start-place=${({
            detail: { element, offset },
          }: StartPlaceEvent) => {
            this.startPlacing(element, offset);
          }}
          @oscd-sld-place=${({
            detail: { element, parent, x, y },
          }: PlaceEvent) => this.placeElement(element, parent, x, y)}
        ></sld-editor>`
    )} `;
  }

  render() {
    if (!this.doc) return html`<p>Please open an SCL document</p>`;
    return html`<main>${this.renderPalette()}${this.renderSldEditor()}</main>
      ${staticHtml`<mwc-dialog id="about" heading="About">
        <div>${unsafeStatic(aboutContent)}</div>
        <mwc-button dialogAction="close" slot="primaryAction">
          close
        </mwc-button>
      </mwc-dialog>`}`;
  }

  static styles = css`
    main {
      padding: 16px;
      width: fit-content;
    }

    div {
      margin-top: 12px;
    }

    nav {
      user-select: none;
      position: sticky;
      top: 68px;
      left: 16px;
      width: fit-content;
      max-width: calc(100vw - 32px);
      background: #fffd;
      border-radius: 24px;
      z-index: 1;
    }

    mwc-icon-button,
    mwc-icon-button-toggle {
      --mdc-theme-text-disabled-on-light: #aaa;
      color: rgb(0, 0, 0 / 0.83);
    }
    mwc-fab {
      --mdc-theme-secondary: #fff;
      --mdc-theme-on-secondary: rgb(0, 0, 0 / 0.83);
    }
  `;
}
