-- Starter supermarket list. Edit to suit your market before running.

insert into public.supermarkets (name, website) values
  ('Aldi', 'https://www.aldi.co.uk'),
  ('Asda', 'https://www.asda.com'),
  ('Co-op', 'https://www.coop.co.uk'),
  ('Iceland', 'https://www.iceland.co.uk'),
  ('Lidl', 'https://www.lidl.co.uk'),
  ('Marks & Spencer', 'https://www.marksandspencer.com'),
  ('Morrisons', 'https://www.morrisons.com'),
  ('Ocado', 'https://www.ocado.com'),
  ('Sainsbury''s', 'https://www.sainsburys.co.uk'),
  ('Tesco', 'https://www.tesco.com'),
  ('Waitrose', 'https://www.waitrose.com')
on conflict (name) do nothing;
