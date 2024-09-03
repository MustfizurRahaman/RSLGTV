from flask import Flask, request, render_template, jsonify
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from io import BytesIO
import base64
import matplotlib
import numpy as np

# Use the Agg backend for non-interactive plotting
matplotlib.use('Agg')

app = Flask(__name__)

df = None
filtered_df = None  # This will hold the filtered data

def create_plot(plot_type, x_column=None, y_column=None, hue=None, multiple=None, kde=False, 
                wavelength_start=None, wavelength_end=None, plot_id=None):
    plt.figure(figsize=(22, 12), constrained_layout=True)

    # Use a spectral color palette
    if plot_type == 'spectral':
        palette = sns.color_palette("dark:#5A9_r", as_cmap=False)
    else:
        palette = sns.color_palette()

    sns.set_theme(style="darkgrid", palette=palette)

    if plot_type == 'hist':
        if multiple and multiple in ["layer", "stack", "fill", "dodge"]:
            plot = sns.histplot(data=filtered_df, x=x_column, hue=hue, multiple=multiple, kde=kde, bins=20)
        else:
            plot = sns.histplot(data=filtered_df, x=x_column, hue=hue, kde=kde, bins=20)
        plt.xlabel(x_column, fontsize=20, fontweight='bold', fontname='Tahoma')
        plt.ylabel('Frequency', fontsize=22, fontweight='bold', fontname='Tahoma')

    elif plot_type == 'scatter':
        plot = sns.scatterplot(x=x_column, y=y_column, hue=hue, data=filtered_df, s=100)
        plt.xlabel(x_column, fontsize=20, fontweight='bold', fontname='Tahoma')
        plt.ylabel(y_column, fontsize=20, fontweight='bold', fontname='Tahoma')

    elif plot_type == 'line':
        plot = sns.lineplot(x=x_column, y=y_column, hue=hue, data=filtered_df, marker='o', markersize=8, color='darkblue', linewidth=2)
        plt.xlabel(x_column, fontsize=20, fontweight='bold', fontname='Tahoma')
        plt.ylabel(y_column, fontsize=20, fontweight='bold', fontname='Tahoma')

    elif plot_type == 'box':
        plot = sns.boxplot(x=x_column, y=y_column, hue=hue, data=filtered_df)
        plt.xlabel(x_column, fontsize=20, fontweight='bold', fontname='Tahoma')
        plt.ylabel(y_column, fontsize=20, fontweight='bold', fontname='Tahoma')

    elif plot_type == 'bar':
        plot = sns.barplot(x=x_column, y=y_column, hue=hue, data=filtered_df)
        plt.xlabel(x_column, fontsize=20, fontweight='bold', fontname='Tahoma')
        plt.ylabel(y_column, fontsize=20, fontweight='bold', fontname='Tahoma')

    elif plot_type == 'spectral':
        # Use the filtered dataset for spectral plot
        if filtered_df is not None:
            df_to_plot = filtered_df
        else:
            df_to_plot = df

        # Convert the selected range of wavelength columns to numeric
        wavelength_columns = df_to_plot.loc[:, wavelength_start:wavelength_end].columns
        melted_df = df_to_plot.melt(id_vars=[plot_id], value_vars=wavelength_columns, 
                                    var_name='Wavelength', value_name='Reflectance')

        melted_df['Wavelength'] = pd.to_numeric(melted_df['Wavelength'], errors='coerce')

        # Plotting the spectral curves
        plot = sns.lineplot(data=melted_df, x='Wavelength', y='Reflectance', hue=plot_id)

        plt.xlabel('Wavelength (nm)', fontsize=20, fontweight='bold', fontname='Tahoma')
        plt.ylabel('Reflectance', fontsize=22, fontweight='bold', fontname='Tahoma')
        # Increase the number of X-axis ticks and make the labels smaller
        


    ax = plt.gca()
    if plot_type == 'spectral':
        ax.set_xticks(np.linspace(melted_df['Wavelength'].min(), melted_df['Wavelength'].max(), num=15))
        plt.xticks(rotation=45, ha='right', fontsize=14, fontweight='bold', fontname='Tahoma')
    else: 
        plt.xticks(rotation=45, ha='right', fontsize=17, fontweight='bold', fontname='Tahoma')
        plt.yticks(fontsize=17, fontweight='bold', fontname='Tahoma')



    # Add background transparency
    plt.gcf().patch.set_alpha(0.6)  # Set figure background transparency
    ax = plt.gca()
    ax.set_facecolor((1, 1, 1, 0.4))  # Set axes background color to be slightly transparent

    # Customize the grid
    ax.grid(True, which='both', color='gray', linestyle='--', linewidth=1)

    if plot:
        # Ensure legend displays only for spectral plot or if there are multiple categories in hue
        if (plot_type == 'spectral') or (hue and filtered_df[hue].nunique() > 1):
            plot.legend(title=plot_id if plot_type == 'Spectral' else hue, loc='center left', bbox_to_anchor=(1.05, 0.5), fontsize=18)
        else:
            plot.legend().remove()

    return plt



@app.route('/', methods=['GET', 'POST'])
def index():
    global df
    if request.method == 'POST':
        file = request.files['file']
        if file and file.filename.endswith('.csv'):
            df = pd.read_csv(file)
            # Ensure date column is in datetime format if it's there
            if 'date' in df.columns:
                df['date'] = pd.to_datetime(df['date'])
            
            # Categorize columns, including `date` as a categorical column for hue
            categorical_columns = df.select_dtypes(include=['object', 'category',  'int64', 'datetime64']).columns.tolist()
            if 'date' in df.columns:
                categorical_columns.append('date')  # Include `date` as a potential hue column
            
            return jsonify({
                'columns': df.columns.tolist(),  # Send all columns for X and Y
                'categorical_columns': categorical_columns  # Send only categorical columns for hue
            })
    return render_template('upload.html')

@app.route('/get-unique-values', methods=['GET'])
def get_unique_values():
    global df
    if df is None:
        return jsonify({'error': 'No data available. Please upload a file first.'}), 400
    
    column = request.args.get('column')
    if column and column in df.columns:
        unique_values = df[column].dropna().unique().tolist()
        unique_values.sort()
        return jsonify({'unique_values': unique_values})
    return jsonify({'error': 'Invalid column name'}), 400

@app.route('/apply-filter', methods=['POST'])
def apply_filter():
    global df, filtered_df
    if df is None:
        return jsonify({'error': 'No data available. Please upload a file first.'}), 400

    filter_column = request.json.get('filter_column')
    filter_values = request.json.get('filter_values')

    # If filter is set to "None" or no filter is selected, reset the filtered_df to the original dataset
    if not filter_column or filter_column == "None":
        filtered_df = df.copy()
    else:
        if "All" in filter_values or "None" in filter_values:
            filtered_df = df.copy()
        else:
            if pd.api.types.is_datetime64_any_dtype(df[filter_column]):
                filter_values = pd.to_datetime(filter_values)
            filtered_df = df[df[filter_column].isin(filter_values)].copy()

    return jsonify({'success': True})


@app.route('/get-plot-data', methods=['GET'])
def get_plot_data():
    global filtered_df, df
    if df is None:
        return jsonify({'error': 'No data available. Please upload a file first.'}), 400
    
    if filtered_df is None:
        filtered_df = df.copy()  # Fallback to original data if no filtering has been applied

    plot_type = request.args.get('type')
    x_column = request.args.get('x')
    y_column = request.args.get('y', None)
    hue = request.args.get('hue', None)
    multiple = request.args.get('multiple', None)
    kde = request.args.get('kde', 'false').lower() == 'true'
    wavelength_start = request.args.get('wavelength_start', None)
    wavelength_end = request.args.get('wavelength_end', None)
    plot_id = request.args.get('plot_id', None)

    plt = create_plot(plot_type, x_column, y_column, hue, multiple, kde, wavelength_start, wavelength_end, plot_id)
    
    img = BytesIO()
    plt.savefig(img, format='png', bbox_inches='tight')
    img.seek(0)
    img_base64 = base64.b64encode(img.getvalue()).decode('utf-8')
    plt.close()

    return jsonify({'plot': img_base64})

@app.route('/save-plot-data', methods=['GET'])
def save_plot_data():
    global filtered_df, df
    if df is None:
        return jsonify({'error': 'No data available. Please upload a file first.'}), 400
    
    if filtered_df is None:
        filtered_df = df.copy()  # Fallback to original data if no filtering has been applied

    plot_type = request.args.get('type')
    x_column = request.args.get('x')
    y_column = request.args.get('y', None)
    hue = request.args.get('hue', None)
    multiple = request.args.get('multiple', None)
    kde = request.args.get('kde', 'false').lower() == 'true'
    wavelength_start = request.args.get('wavelength_start', None)
    wavelength_end = request.args.get('wavelength_end', None)
    plot_id = request.args.get('plot_id', None)
    format = request.args.get('format', 'png')  # Default to PNG

    plt = create_plot(plot_type, x_column, y_column, hue, multiple, kde, wavelength_start, wavelength_end, plot_id)

    img = BytesIO()
    plt.savefig(img, format=format, bbox_inches='tight', dpi=400)  # Set DPI to 400
    img.seek(0)
    img_base64 = base64.b64encode(img.getvalue()).decode('utf-8')
    plt.close()

    return jsonify({'plot': img_base64, 'format': format})


if __name__ == '__main__':
    app.run(debug=True)
