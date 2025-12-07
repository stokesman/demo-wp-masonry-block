<?php
/**
 * Plugin Name: Demo Masonry Block
 * Description: Masonry-powered block working the block editor (iframed or not).
 * Version: 0.1.0
 */

namespace S8\WP\blocks;

require plugin_dir_path( __FILE__ ) . 'block.php';

function assign_json_data( string $global_name, array $assignments ): string {
	$ns = "'$global_name'";
	$value = wp_json_encode( $assignments );
	return <<<JS
		if ( ! ( $ns in window ) ) window[ $ns ] = $value;
	JS;
}

function get_from_dir( $relPath ){
	return file_get_contents( plugin_dir_path( __FILE__ ) . $relPath );
}

add_action( 'init', function() {
	wp_register_script('pexels', plugins_url( 'lib/pexels.js', __FILE__ ), [], '1.4.0' );
} );

add_action( 'enqueue_block_editor_assets', function() {
	// If pexels-key.php is available its contained key is used to load images from pexels.
	$pexels_file = plugin_dir_path( __FILE__ ) . 'pexels-key.php';
	if ( file_exists( $pexels_file ) ) $pexels_key = get_from_dir( 'pexels-key.php');
	else $pexels_key = 'null';

	$here = plugin_dir_url( __FILE__ );

	$blockType = json_decode( get_from_dir( 'block.json' ) );
	$partialBlockType = [];
	foreach ( $blockType as $key => $value )
		if (
			match ( $key ) {
				'name', 'icon', 'title', 'description', 'attributes', 'supports' => true,
				default => false,
			}
		) $partialBlockType[ $key ] = $value;

	// Assigns js global for later script access.
	wp_add_inline_script(
		's8-demo-masonry-editor-script',
		assign_json_data( 's8-demo-masonry-editor-data', [
			'metadata' => $partialBlockType,
			'pexelsKey' => $pexels_key,
			'dir' => $here,
		] ),
		'before'
	);
}, 1000 );
