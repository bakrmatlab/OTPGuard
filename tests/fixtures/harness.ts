import { observeDetection } from '../../apps/extension/detection';
const result = document.querySelector('#result')!;
observeDetection(document, (snapshot) => {
  result.textContent = JSON.stringify({
    ...snapshot,
    groups: snapshot.groups.map((group) => ({
      ...group,
      fields: group.fields.map((field) => field.closest('form, fieldset')?.id),
    })),
  });
});
document.querySelector('#replace')!.addEventListener('click', () => {
  const field = document.querySelector('#single input')!;
  field.replaceWith(field.cloneNode());
});
export {
  createDetector,
  observeDetection,
} from '../../apps/extension/detection';
