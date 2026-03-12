gunicorn -w 1 -b 0.0.0.0:8080 --timeout 300 app:app
lsof -i :8080      
source .venv/bin/activate 


The goal of the study was to evaluate whether a distributed flicker stimulus could induce gamma activity. Motion was included to reduce neural adaptation and maintain engagement, but comparing motion vs stationary stimuli was outside the scope of this experiment.