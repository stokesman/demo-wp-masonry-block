<?php
/**
 * Plugin Name: Demo Masonry Block
 * Description: Masonry-powered block working the block editor (iframed or not).
 * Version: 0.1.0
 */

namespace S8\WP\blocks;

CONST JS_NS = '"s8/"';

require plugin_dir_path( __FILE__ ) . 'block.php';

function jsAssignments( $assignments ){
	$ns = JS_NS;
	ob_start();
	?>
	if ( ! (<?= $ns ?> in window ) ){
		window[<?= $ns ?>] = {};
	}
	<?php
	foreach ($assignments as $prop_name => $jsonString ) {
		?>
		window[<?= $ns ?>]['<?= $prop_name ?>'] = <?= $jsonString ?>;
		<?php
	}
	return ob_get_clean();
}

function jsSetIframedMasonryReady() {
	$ns = JS_NS;
	return <<<JS
		if (window.frameElement !== null)
			window.top.wp.data.dispatch(window.top[$ns]['demo-masonry-store']).setReady(true)
	JS;
}

function get_from_dir( $relPath ){
	ob_start();
	include plugin_dir_path( __FILE__ ) . $relPath;
	return ob_get_clean();
}

add_action( 'init', function() {
	wp_register_script('pexels', plugins_url( 'lib/pexels.js', __FILE__ ), [], '1.4.0' );
} );

add_action( 'enqueue_block_editor_assets', function() {
	// If pexels-key.php is available its contained key is used to load images from pexels.
	$pexels_file = plugin_dir_path( __FILE__ ) . 'pexels-key.php';
	if ( file_exists( $pexels_file ) ) $pexels_key = get_from_dir( 'pexels-key.php');
	else $pexels_key = 'null';

	// Assigns js globals for later script access.
	wp_add_inline_script(
		's8-demo-masonry-editor-script',
		jsAssignments( [
			'demo-masonry' => get_from_dir( 'block.json' ),
			'pexelsKey' => $pexels_key,
		] ),
		'before'
	);

	// Updates the store once the masonry library is loaded in the editor’s iframe.
	wp_add_inline_script( 'masonry', jsSetIframedMasonryReady() );
}, 1000 );
