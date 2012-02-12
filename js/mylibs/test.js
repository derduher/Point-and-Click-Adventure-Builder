$(function() {

	$('#key').on('dragstart', function(e){
		console.log('dragstart');
		e.originalEvent.dataTransfer.setData('Text', this.id);
	}).on('dragend', function(e){
		console.log('dragend');
	});
	$('#door').on('dragenter', function (e) {
		console.log('dragenter');
		e.preventDefault();
		e.originalEvent.dataTransfer.dropEffect = 'move';
	}).on('dragover', function (e) {
		e.preventDefault();
	}).on('drop', function (e) {
		console.log('drop');
		e.preventDefault();
	});
});
