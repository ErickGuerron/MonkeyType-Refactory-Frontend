import Swal, { type SweetAlertIcon, type SweetAlertOptions } from 'sweetalert2';
import { t } from '../../core/i18n';

const baseCustomClass = {
	popup: 'monkey-swal',
	title: 'monkey-swal__title',
	htmlContainer: 'monkey-swal__content',
	confirmButton: 'monkey-swal__confirm',
	cancelButton: 'monkey-swal__cancel',
	closeButton: 'monkey-swal__close',
	icon: 'monkey-swal__icon'
} as const;

function createOptions(options: SweetAlertOptions): SweetAlertOptions {
	return {
		background: '#181818',
		color: '#f7f1dd',
		confirmButtonText: t('alerts.ok'),
		buttonsStyling: false,
		customClass: baseCustomClass,
		...options
	};
}

export function showAlert(options: SweetAlertOptions) {
	return Swal.fire(createOptions(options));
}

export function showToast({
	title,
	text,
	icon = 'success',
	timer = 2400
}: {
	title: string;
	text?: string;
	icon?: SweetAlertIcon;
	timer?: number;
}) {
	return Swal.fire(
		createOptions({
			toast: true,
			position: 'top-end',
			showConfirmButton: false,
			timer,
			timerProgressBar: true,
			icon,
			title,
			text
		})
	);
}

export function showSuccessAlert(title: string, text: string) {
	return showAlert({ icon: 'success', title, text });
}

export function showWarningAlert(title: string, text: string) {
	return showAlert({ icon: 'warning', title, text, confirmButtonText: t('alerts.okShort') });
}

export function showErrorAlert(message: string, title = t('alerts.errorTitle')) {
	return showAlert({ icon: 'error', title, text: message, confirmButtonText: t('alerts.retry') });
}

export function closeAlert() {
	Swal.close();
}
