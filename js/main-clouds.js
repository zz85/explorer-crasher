'use strict'

function checkFloatTextures() {

	var ctx = document.createElement( 'canvas' ).getContext( 'experimental-webgl' );
	return ctx.getExtension( 'OES_texture_half_float' );

}

function check() {

	checkFloatTextures();
	init();

}

if( Detector.webgl ) {
	window.addEventListener( 'load', check, false );
} else {

}

var container;

var scene, camera, light, renderer, controls;
var geometry, cube, mesh, material, shadowMaterial, plane;
var timer, start, prevTime;

var data, texture, points;

var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();

var sim;
var nOffset = new THREE.Vector3( 0, 0, 0 );
var tmpVector = new THREE.Vector3( 0, 0, 0 );

var proxy

var shadowBuffer, shadowBufferSize, shadowCamera, shadowDebug

var colors = [
	0xed6a5a,
	0xf4f1bb,
	0x9bc1bc,
	0x5ca4a9,
	0xe6ebe0,
	0xf0b67f,
	0xfe5f55,
	0xd6d1b1,
	0xc7efcf,
	0xeef5db,
	0x50514f,
	0xf25f5c,
	0xffe066,
	0x247ba0,
	0x70c1b3
];

colors = [ 0xffffff ];

var scale = 0, nScale = 1;

var params = {
	type: 2,
	spread: 4,
	factor: .89,
	evolution: .35,
	rotation: .95,
	radius: 0.4,
	pulsate: false,
	scaleX: .3,
	scaleY: .3,
	scaleZ: 10,
	scale: 2
};

var cardTexture;
var cardBackTexture;

var gui = new dat.GUI();

function init() {

	container = document.getElementById( 'container' );

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	//renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( 0x450505 );
	container.appendChild( renderer.domElement );

	cardTexture = THREE.ImageUtils.loadTexture( "cloud.png" );
	//cardTexture = THREE.ImageUtils.loadTexture( "cards2.png" );
	cardTexture.wrapS = cardTexture.wrapT = THREE.RepeatWrapping;
	cardTexture.anisotropy = 8;

	cardBackTexture = THREE.ImageUtils.loadTexture( "cloud.png" );
	//cardBackTexture = THREE.ImageUtils.loadTexture( "cardback.png" );
	cardBackTexture.wrapS = cardBackTexture.wrapT = THREE.RepeatWrapping;
	cardBackTexture.anisotropy = 8;

	plane = new THREE.Mesh( new THREE.PlaneGeometry( 10000, 10000 ), new THREE.MeshNormalMaterial( { side: THREE.DoubleSide, visible: true } ) );
	scene = new THREE.Scene();
	plane.material.visible = false;

	scene.add( plane );

	camera = new THREE.PerspectiveCamera( 20, window.innerWidth / window.innerHeight, .01, 100 );
	scene.add( camera );
	camera.position.z = 28;

	var s = 15;
	shadowCamera = new THREE.OrthographicCamera( -s, s, s, -s, .1, 20 );
	shadowCamera.position.set( 10, 4, 10 );
	shadowCamera.lookAt( scene.position );

	var light = new THREE.Mesh( new THREE.CylinderGeometry( 5, 6, 1, 36 ), new THREE.MeshBasicMaterial( { color: 0xffffff }) );
	light.position.copy( shadowCamera.position );
	scene.add( light );
	light.lookAt( scene.position );
	light.rotation.y += Math.PI / 2;
	light.rotation.z += Math.PI / 2;

	var encasing = new THREE.Mesh( new THREE.CylinderGeometry( 5.1, 6.1, .9, 36 ), new THREE.MeshBasicMaterial( { color: 0x101010 }) );
	encasing.position.copy( shadowCamera.position ).multiplyScalar(1.01);
	scene.add( encasing );
	encasing.lookAt( scene.position );
	encasing.rotation.y += Math.PI / 2;
	encasing.rotation.z += Math.PI / 2;

	var b = new THREE.CameraHelper( shadowCamera );
	//scene.add( b );

	controls = new THREE.OrbitControls( camera, renderer.domElement );

	var size = parseInt( window.location.hash.substr(1) ) || 128;
	sim = new Simulation( renderer, size, size );

	shadowBufferSize = 1024;
	shadowBuffer = new THREE.WebGLRenderTarget( shadowBufferSize, shadowBufferSize, {
		wrapS: THREE.ClampToEdgeWrapping,
		wrapT: THREE.ClampToEdgeWrapping,
		minFilter: THREE.LinearMipMapLinear,
		magFilter: THREE.LinearFilter,
		format: THREE.RGBAFormat,
		type: THREE.FloatType,
		stencilBuffer: false
	} );

	var geometry = new THREE.BufferGeometry();

	var positionsLength = sim.width * sim.height * 3 * 18;
	var positions = new Float32Array( positionsLength );

	var p = 0;
	for( var j = 0; j < positionsLength; j += 3 ) {
		positions[ j ] = p;
		positions[ j + 1 ] = 0;
		positions[ j + 2 ] = 0;
		p++;
	}

	var cardsLength = sim.width * sim.height * 3 * 18;
	var cards = new Float32Array( cardsLength );

	var p = 0;
	for( var j = 0; j < cardsLength; j += 3 * 18 ) {

		var cx = Math.floor( Math.random() * 4 );
		var cy = Math.floor( Math.random() * 13 );
		var cz = Math.random() < 0.5 ? 0 : 1;

		for ( var k = 0; k < 3 * 18; k += 3 ) {

			cards[ j + k] = cx;
			cards[ j + k + 1 ] = cy;
			cards[ j + k + 2 ] = cz;

		}
		p++;
	}

	geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
	geometry.addAttribute( 'card', new THREE.BufferAttribute( cards, 3 ) );

	var diffuseData = new Uint8Array( size * size * 4 );
	for( var j = 0; j < size * size * 4; j += 4 ) {
		var c = new THREE.Color( colors[ ~~( Math.random() * colors.length ) ] );
		diffuseData[ j + 0 ] = c.r * 255;
		diffuseData[ j + 1 ] = c.g * 255;
		diffuseData[ j + 2 ] = c.b * 255;
	}

	var diffuseTexture = new THREE.DataTexture( diffuseData, size, size, THREE.RGBAFormat );
	diffuseTexture.minFilter = THREE.NearestFilter;
	diffuseTexture.magFilter = THREE.NearestFilter;
	diffuseTexture.needsUpdate = true;

	material = new THREE.RawShaderMaterial( {

		uniforms: {

			texture: { type: "t", value: cardTexture },
			textureBack: { type: "t", value: cardBackTexture },
			map: { type: "t", value: sim.rtTexturePos },
			prevMap: { type: "t", value: sim.rtTexturePos },
			diffuse: { type: 't', value: diffuseTexture },
			width: { type: "f", value: sim.width },
			height: { type: "f", value: sim.height },

			timer: { type: 'f', value: 0 },
			spread: { type: 'f', value: 4 },
			boxScale: { type: 'v3', value: new THREE.Vector3() },
			meshScale: { type: 'f', value: 1 },

			depthTexture: { type: 't', value: shadowBuffer },
			shadowV: { type: 'm4', value: new THREE.Matrix4() },
			shadowP: { type: 'm4', value: new THREE.Matrix4() },
			resolution: { type: 'v2', value: new THREE.Vector2( shadowBufferSize, shadowBufferSize ) },
			lightPosition: { type: 'v3', value: new THREE.Vector3() },
			projector: { type: 't', value: THREE.ImageUtils.loadTexture( 'spotlight.jpg' ) },

			boxVertices: { type: '3fv', value: [

				-1,-1,-1,
				-1,-1, 1,
				-1, 1, 1,

				-1,-1,-1,
				-1, 1, 1,
				-1, 1,-1,

				1, 1,-1,
				1,-1,-1,
				-1,-1,-1,

				1, 1,-1,
				-1,-1,-1,
				-1, 1,-1,

				1,-1, 1,
				-1,-1, 1,
				-1,-1,-1,

				1,-1, 1,
				-1,-1,-1,
				1,-1,-1,

			] },
			boxNormals: { type: '3fv', value: [

				1, 0, 0,
				0, 0, 1,
				0, 1, 0

			] },

		},
		vertexShader: document.getElementById( 'vs-particles' ).textContent,
		fragmentShader: document.getElementById( 'fs-particles' ).textContent,
		side: THREE.DoubleSide,
		shading: THREE.FlatShading,
		transparent: true
	} );

	mesh = new THREE.Mesh( geometry, material );

	shadowMaterial = new THREE.RawShaderMaterial( {

		uniforms: {

			map: { type: "t", value: sim.rtTexturePos },
			prevMap: { type: "t", value: sim.rtTexturePos },
			width: { type: "f", value: sim.width },
			height: { type: "f", value: sim.height },

			timer: { type: 'f', value: 0 },
			boxScale: { type: 'v3', value: new THREE.Vector3() },
			meshScale: { type: 'f', value: 1 },

			shadowV: { type: 'm4', value: new THREE.Matrix4() },
			shadowP: { type: 'm4', value: new THREE.Matrix4() },
			resolution: { type: 'v2', value: new THREE.Vector2( shadowBufferSize, shadowBufferSize ) },
			lightPosition: { type: 'v3', value: new THREE.Vector3() },

			boxVertices: { type: '3fv', value: [

				-1,-1,-1,
				-1,-1, 1,
				-1, 1, 1,

				-1,-1,-1,
				-1, 1, 1,
				-1, 1,-1,

				1, 1,-1,
				1,-1,-1,
				-1,-1,-1,

				1, 1,-1,
				-1,-1,-1,
				-1, 1,-1,

				1,-1, 1,
				-1,-1, 1,
				-1,-1,-1,

				1,-1, 1,
				-1,-1,-1,
				1,-1,-1,

			] },
			boxNormals: { type: '3fv', value: [

				1, 0, 0,
				0, 0, 1,
				0, 1, 0

			] },

		},
		vertexShader: document.getElementById( 'vs-particles' ).textContent,
		fragmentShader: document.getElementById( 'fs-particles-shadow' ).textContent,
		side: THREE.DoubleSide
	} );

	scene.add( mesh );

	proxy = new THREE.Mesh( new THREE.IcosahedronGeometry( .2, 2 ), new THREE.MeshNormalMaterial() );
	//scene.add( proxy );
	proxy.material.visible = false;

	var center = new THREE.Mesh( new THREE.BoxGeometry( 1, 1, 1 ), new THREE.MeshNormalMaterial() );
	//scene.add( center );

	window.addEventListener( 'resize', onWindowResize, false );

	function onWindowResize() {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

	}

	onWindowResize();

	var isIntersect = false;

	window.addEventListener( 'mousemove', function( e ) {

		mouse.x = ( e.clientX / renderer.domElement.clientWidth ) * 2 - 1;
		mouse.y = - ( e.clientY / renderer.domElement.clientHeight ) * 2 + 1;

	});

	window.addEventListener( 'mousedown', function( e ) {

		nScale = 2;

	});

	window.addEventListener( 'mouseup', function( e ) {

		nScale = .5;

	});

	window.addEventListener( 'keydown', function( e ) {

		if( e.keyCode === 32 ) {
			sim.simulationShader.uniforms.active.value = 1 - sim.simulationShader.uniforms.active.value;
		}

	});

	window.addEventListener( 'touchmove', function( e ) {

		mouse.x = ( e.touches[ 0 ].clientX / renderer.domElement.clientWidth ) * 2 - 1;
		mouse.y = - ( e.touches[ 0 ].clientY / renderer.domElement.clientHeight ) * 2 + 1;

	});

	shadowDebug = new THREE.Mesh( new THREE.PlaneGeometry( 10,10 ), new THREE.MeshBasicMaterial( { map: shadowBuffer, side: THREE.DoubleSide } ) );
	//scene.add( shadowDebug );

	//gui.add( params, 'type', { 'none': 0, 'single': 1, 'multisample': 2, 'poisson': 3 } );
	//gui.add( params, 'spread', 0, 10 );
	gui.add( params, 'factor', 0.1, 1 );
	gui.add( params, 'evolution', 0, 1 );
	gui.add( params, 'rotation', 0, 1 );
	gui.add( params, 'radius', 0, 4 );
	gui.add( params, 'pulsate' );
	gui.add( params, 'scaleX', .01, 10 );
	gui.add( params, 'scaleY', .01, 10 );
	gui.add( params, 'scaleZ', .01, 10 );
	gui.add( params, 'scale', .1, 2 );

	animate();

}

function animate() {

	render();
	requestAnimationFrame( animate );

}

var t = new THREE.Clock();
var m = new THREE.Matrix4();

var tmpVector = new THREE.Vector3();

function render() {

	controls.update();

	scale += ( nScale - scale ) * .01;

	plane.lookAt( camera.position );

	raycaster.setFromCamera( mouse, camera );

	var intersects = raycaster.intersectObject( plane );

	if( intersects.length ) {
		nOffset.copy( intersects[ 0 ].point );
		proxy.position.copy( nOffset );
	}

	var delta = t.getDelta() * 10;
	var time = t.elapsedTime;

	tmpVector.copy( nOffset );
	tmpVector.sub( sim.simulationShader.uniforms.offset.value );
	tmpVector.multiplyScalar( .1 );
	sim.simulationShader.uniforms.offset.value.add( tmpVector );
	sim.simulationShader.uniforms.factor.value = params.factor;
	sim.simulationShader.uniforms.evolution.value = params.evolution;
	sim.simulationShader.uniforms.radius.value = params.pulsate ? ( .5 + .5 * Math.cos( time ) ) * params.radius : params.radius;

	if( sim.simulationShader.uniforms.active.value ) {
		mesh.rotation.y = params.rotation * time;
	}

	m.copy( mesh.matrixWorld );
	sim.simulationShader.uniforms.inverseModelViewMatrix.value.getInverse( m );
	sim.simulationShader.uniforms.genScale.value = scale;

	if( sim.simulationShader.uniforms.active.value === 1 ) {
		sim.render( time, delta );
	}
	material.uniforms.map.value = shadowMaterial.uniforms.map.value = sim.targets[ sim.targetPos ];
	material.uniforms.prevMap.value = shadowMaterial.uniforms.prevMap.value = sim.targets[ 1 - sim.targetPos ];

	material.uniforms.spread.value = params.spread;
	material.uniforms.timer.value = shadowMaterial.uniforms.timer.value = time;
	material.uniforms.boxScale.value.set( params.scaleX, params.scaleY, params.scaleZ );
	shadowMaterial.uniforms.boxScale.value.set( params.scaleX, params.scaleY, params.scaleZ );
	material.uniforms.meshScale.value = params.scale;
	shadowMaterial.uniforms.meshScale.value = params.scale;

	renderer.setClearColor( 0 );
	mesh.material = shadowMaterial;
	renderer.render( scene, shadowCamera, shadowBuffer );

	tmpVector.copy( scene.position );
	tmpVector.sub( shadowCamera.position );
	tmpVector.normalize();

	material.uniforms.shadowP.value.copy( shadowCamera.projectionMatrix );
	material.uniforms.shadowV.value.copy( shadowCamera.matrixWorldInverse );
	material.uniforms.lightPosition.value.copy( shadowCamera.position );

//	renderer.setClearColor( 0x336633 );
	renderer.setClearColor( 0x452525 );
	mesh.material = material;
	renderer.render( scene, camera );

}