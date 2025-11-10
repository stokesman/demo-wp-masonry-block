( ( wp ) => {
const { registerBlockType } = wp.blocks;
const { createElement: el, useEffect, useRef, useState } = wp.element;
const { useBlockProps } = wp.blockEditor;
const { useMergeRefs, useRefEffect } = wp.compose;

const BLOCK_NS = 's8/';
const NAME = 'demo-masonry';
// “import” from the block json which has been assigned to the “namespace”.
const {
	title,
	icon,
	description,
	attributes,
	supports
} = window[BLOCK_NS][NAME];

const PEXELS_KEY = window[BLOCK_NS]['pexelsKey'];

const mapAspects = {
	'0.76': 'narrow',
	'1.0':  'square',
	'1.32': 'wide'
};
const [narrow, square, wide] = Object.keys( mapAspects ).map( parseFloat );
const getAspectClass = ratio => {
	let clamped = Math.min( wide, Math.max( ratio, narrow ) );
	clamped = clamped === ratio ? square.toPrecision( 2 ) : `${ clamped }`;
	// console.log(mapAspects[ clamped ], ' - ', {ratio, clamped})
	return mapAspects[ clamped ];
};

let isMasonryDefinedInIframe = false;

registerBlockType( BLOCK_NS + NAME, {
	title,
	icon,
	description,
	attributes,
	supports,

	edit: () => {
		// To use Masonry without jQuery when the editor canvas is in the iframe, the block
		// has to use Masonry from within the iframe but the block has to wait for it to be
		// available and this state ensures the block rerenders then.
		const [ isMasonryDefined, setIsMasonryDefined ] = useState( isMasonryDefinedInIframe );

		const [ images, setImages ] = useState();

		// Populates images from Pexels if a API key is available and otherwise some dummy images.
		useEffect( () => {
			if ( !PEXELS_KEY ) {
				setImages( Array.from({ length: 13 }, (v, i) => {
					const width = [300, 450, 600][ Math.floor( Math.random() * 3 ) ];
					const height = [300, 450, 600][ Math.floor( Math.random() * 3 ) ];
					return {
						src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
						style: {
							background: ['mistyrose', 'papayawhip', 'antiquewhite', 'gainsboro', 'cornsilk' ][ Math.floor( Math.random() * 5 ) ],
							aspectRatio: `${width} / ${height}`,
						},
						aspectRatio: width / height
					}
				}))
			} else {
				const client = window.pexels.createClient( PEXELS_KEY );
				const query = ['buns', 'lemon', 'curves'][ Math.floor( Math.random() * 3 ) ];
				const page = Math.ceil(Math.random() * 9);
				// console.log({query, page})
				client.photos
					.search({ query, page, per_page: 13 })
					.then(({ photos }) => setImages(
						photos.map( ( { src: { large }, width, height } ) => ( {
							src: large,
							aspectRatio: width / height
						} ) ) )
					);
			}
		}, [] );

		// Tracks the ready state of the document to hold off on creating
		// Masonry until the document is complete.
		const [ isCanvasReady, setIsCanvasReady ] = useState( false );
		const refCanvasReady = useRefEffect( ( node ) => {
			const { ownerDocument: canvasDoc } = node;
			if ( canvasDoc === document || canvasDoc.readyState === 'complete' ) {
				setIsCanvasReady( true );
				return;
			}
			canvasDoc.addEventListener( 'DOMContentLoaded', () => {
				setIsCanvasReady( true );
			} );
		}, [] );

		// Keeps a reference to the Masonry instance for sharing accross effect hooks.
		const refMasonry = useRef();

		// Tracks the size of the block to (re)layout Masonry.
		const refResize = useRefEffect( ( node ) => {
			const sizer = new ResizeObserver(
				() => refMasonry.current?.layout()
			)
			sizer.observe( node );
			return () => sizer.disconnect();
		}, [] );

		// Pass no dependencies to ensure that each rerender the check for Masonry runs -
		// that is, until this stops being assigned to the block ref after Masonry is defined.  
		const refEffectUntilMasonry = useRefEffect(
			( element ) => {
				setIsMasonryDefined( !! element.ownerDocument.defaultView?.Masonry );
				// Let’s another block initialize with the same state.
				isMasonryDefinedInIframe = true;
			}
		);

		// Creates and destroys the Masonry instance as warranted.
		const refEffectMasonry = useRefEffect( ( element ) => {
			const { ownerDocument: { defaultView: { Masonry } } } = element;

			if ( ! isCanvasReady || ! images ) return;

			imagesLoaded(element, () => {
				refMasonry.current = new Masonry( element, {
					itemSelector: 'img',
					columnWidth: '.grid-sizer',
					percentPosition: true,
					gutter: 12,
					resize: false, // leave it to the resize observer.
				} );
			});

			return () => refMasonry.current?.destroy();
		}, [ images, isCanvasReady ] );

		const blockProps = useBlockProps( {
			ref: useMergeRefs( [
				refCanvasReady,
				// Until Masonry is defined attach the effect that checks for it and afterward
				// attach the effect that creates and destroys the block’s instance of it.
				! isMasonryDefined ? refEffectUntilMasonry : refEffectMasonry,
				refResize,
			] ),
		} );

		let innards = null;
		if ( images && isCanvasReady ) {
			innards = images.map( ( { src, aspectRatio, style }, index ) => {
				return el( 'img', {
					src,
					style,
					alt: '',
					key: index,
					className: getAspectClass( aspectRatio ),
				} )
			} );
			innards.push( el( 'div', { className: 'grid-sizer', key: 'grid-sizer' } ) );
		}

		return el('div', blockProps, innards || 'fetchin’ fotos…' );
	},
	save: () => null
} );

} )( window.wp );