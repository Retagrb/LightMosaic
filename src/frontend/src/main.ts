import './style.css';
import { CeremonyController } from './ceremony/controller';

const host = document.getElementById('app');
if (!host) throw new Error('#app not found');

const controller = new CeremonyController();
controller.init(host).catch((err) => {
  console.error(err);
  host.textContent = `Display failed to start: ${err}`;
});
